import { DatabaseManager } from '../database/DatabaseManager';

export interface ITransaction {
  id: number;
  from_user_id?: number;
  to_user_id: number;
  amount: number;
  reason?: string;
  transaction_type: 'transfer' | 'semester_credit' | 'redemption';
  created_at: string;
}

export class Transaction {
  private db = DatabaseManager.getInstance().getDb();

  public async create(transactionData: Omit<ITransaction, 'id' | 'created_at'>): Promise<ITransaction> {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const stmt = this.db.prepare(`
        INSERT INTO transactions (from_user_id, to_user_id, amount, reason, transaction_type)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        transactionData.from_user_id,
        transactionData.to_user_id,
        transactionData.amount,
        transactionData.reason,
        transactionData.transaction_type,
        function(err) {
          if (err) {
            reject(err);
          } else {
            const findStmt = db.prepare('SELECT * FROM transactions WHERE id = ?');
            findStmt.get(this.lastID, (err, row) => {
              if (err) {
                reject(err);
              } else {
                resolve(row as ITransaction);
              }
            });
          }
        }
      );
    });
  }

  public findById(id: number): Promise<ITransaction | null> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT t.*, 
               u1.email as from_email,
               u2.email as to_email
        FROM transactions t
        LEFT JOIN users u1 ON t.from_user_id = u1.id
        JOIN users u2 ON t.to_user_id = u2.id
        WHERE t.id = ?
      `);
      stmt.get(id, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as ITransaction | null);
        }
      });
    });
  }

  public findByUserId(userId: number): Promise<ITransaction[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT t.*, 
               u1.email as from_email,
               u2.email as to_email
        FROM transactions t
        LEFT JOIN users u1 ON t.from_user_id = u1.id
        JOIN users u2 ON t.to_user_id = u2.id
        WHERE t.from_user_id = ? OR t.to_user_id = ?
        ORDER BY t.created_at DESC
      `);
      stmt.all(userId, userId, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as ITransaction[]);
        }
      });
    });
  }

  public findAll(): Promise<ITransaction[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT t.*, 
               u1.email as from_email,
               u2.email as to_email
        FROM transactions t
        LEFT JOIN users u1 ON t.from_user_id = u1.id
        JOIN users u2 ON t.to_user_id = u2.id
        ORDER BY t.created_at DESC
      `);
      stmt.all((err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as ITransaction[]);
        }
      });
    });
  }

  public getBalance(userId: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT 
          COALESCE(SUM(CASE WHEN to_user_id = ? THEN amount ELSE 0 END), 0) -
          COALESCE(SUM(CASE WHEN from_user_id = ? THEN amount ELSE 0 END), 0) as balance
        FROM transactions
      `);
      stmt.get(userId, userId, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve((row as { balance: number }).balance);
        }
      });
    });
  }
}