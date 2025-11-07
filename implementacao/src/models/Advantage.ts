import { DatabaseManager } from '../database/DatabaseManager';

export interface IAdvantage {
  id: number;
  company_id: number;
  title: string;
  description: string;
  image_url?: string;
  cost_coins: number;
  is_active: boolean;
  created_at: string;
}

export class Advantage {
  private db = DatabaseManager.getInstance().getDb();

  public async create(advantageData: Omit<IAdvantage, 'id' | 'created_at'>): Promise<IAdvantage> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO advantages (company_id, title, description, image_url, cost_coins, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        advantageData.company_id,
        advantageData.title,
        advantageData.description,
        advantageData.image_url || null,
        advantageData.cost_coins,
        advantageData.is_active,
        function(err) {
          if (err) {
            reject(err);
          } else {
            if (!this.lastID) {
              const findStmt = this.db.prepare('SELECT * FROM advantages WHERE company_id = ? AND title = ?');
              findStmt.get(advantageData.company_id, advantageData.title, (err, row) => {
                if (err) {
                  reject(err);
                } else if (!row) {
                  reject(new Error('Advantage not found after insert'));
                } else {
                  resolve(row as IAdvantage);
                }
              });
            } else {
              const findStmt = this.db.prepare('SELECT * FROM advantages WHERE id = ?');
              findStmt.get(this.lastID, (err, row) => {
                if (err) {
                  reject(err);
                } else if (!row) {
                  reject(new Error('Advantage not found after insert'));
                } else {
                  resolve(row as IAdvantage);
                }
              });
            }
          }
        }.bind(this)
      );
    });
  }

  public findById(id: number): Promise<IAdvantage | null> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT a.*, c.name as company_name
        FROM advantages a
        JOIN companies c ON a.company_id = c.id
        WHERE a.id = ?
      `);
      stmt.get(id, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row as IAdvantage | null);
        }
      });
    });
  }

  public findByCompanyId(companyId: number): Promise<IAdvantage[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT a.*, c.name as company_name
        FROM advantages a
        JOIN companies c ON a.company_id = c.id
        WHERE a.company_id = ?
        ORDER BY a.created_at DESC
      `);
      stmt.all(companyId, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as IAdvantage[]);
        }
      });
    });
  }

  public findAll(): Promise<IAdvantage[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT a.*, c.name as company_name
        FROM advantages a
        JOIN companies c ON a.company_id = c.id
        ORDER BY a.created_at DESC
      `);
      stmt.all((err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as IAdvantage[]);
        }
      });
    });
  }

  public findActive(): Promise<IAdvantage[]> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        SELECT a.*, c.name as company_name
        FROM advantages a
        JOIN companies c ON a.company_id = c.id
        WHERE a.is_active = 1 AND c.is_active = 1
        ORDER BY a.created_at DESC
      `);
      stmt.all((err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as IAdvantage[]);
        }
      });
    });
  }

  public update(id: number, advantageData: Partial<IAdvantage>): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(advantageData).filter(key => key !== 'id' && key !== 'company_id');
      const setClause = fields.map(field => `${field} = ?`).join(', ');
      const values = fields.map(field => advantageData[field as keyof IAdvantage]);

      const stmt = this.db.prepare(`UPDATE advantages SET ${setClause} WHERE id = ?`);
      stmt.run(...values, id, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  public delete(id: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare('DELETE FROM advantages WHERE id = ?');
      stmt.run(id, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }

  public toggleActive(id: number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE advantages 
        SET is_active = NOT is_active 
        WHERE id = ?
      `);
      stmt.run(id, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }
}

