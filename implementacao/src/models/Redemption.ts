import { DatabaseManager } from '../database/DatabaseManager';

export interface IRedemption {
  id: number;
  student_id: number;
  advantage_id: number;
  transaction_id: number;
  redemption_code: string;
  status: 'pending' | 'completed' | 'cancelled';
  created_at: string;
}

export class Redemption {
  private db = DatabaseManager.getInstance().getDb();

  public async create(redemptionData: Omit<IRedemption, 'id' | 'created_at'>): Promise<IRedemption> {
    return new Promise((resolve, reject) => {
      const db = this.db;
      const stmt = this.db.prepare(`
        INSERT INTO redemptions (student_id, advantage_id, transaction_id, redemption_code, status)
        VALUES (?, ?, ?, ?, ?)
      `);

      stmt.run(
        redemptionData.student_id,
        redemptionData.advantage_id,
        redemptionData.transaction_id,
        redemptionData.redemption_code,
        redemptionData.status,
        function(err) {
          if (err) {
            reject(err);
          } else {
            const findStmt = db.prepare('SELECT * FROM redemptions WHERE id = ?');
            findStmt.get(this.lastID, (findErr, row) => {
              if (findErr) {
                reject(findErr);
              } else {
                resolve(row as IRedemption);
              }
            });
          }
        }
      );
    });
  }

  public findByStudentAndAdvantage(studentId: number, advantageId: number): Promise<IRedemption | null> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT *
        FROM redemptions
        WHERE student_id = ? AND advantage_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `);

      stmt.get(studentId, advantageId, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve((row as IRedemption) || null);
        }
      });
    });
  }

  public findByStudentId(studentId: number): Promise<IRedemption[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT *
        FROM redemptions
        WHERE student_id = ?
        ORDER BY created_at DESC
      `);

      stmt.all(studentId, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as IRedemption[]);
        }
      });
    });
  }
}


