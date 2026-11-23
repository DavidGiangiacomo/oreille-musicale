// Base D1 simulée sur le SQLite intégré à Node, pour tester le Worker sans
// Cloudflare : D1 est du SQLite, les requêtes sont donc vérifiées pour de vrai.
// Seule la partie de l'API D1 utilisée par le Worker est reproduite.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

class Statement {
  constructor(
    private readonly db: DatabaseSync,
    readonly sql: string,
    readonly params: SQLInputValue[] = [],
  ) {}

  bind(...params: SQLInputValue[]) {
    return new Statement(this.db, this.sql, params);
  }

  async first<T>(): Promise<T | null> {
    return (this.db.prepare(this.sql).get(...this.params) as T | undefined) ?? null;
  }

  async all<T>() {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return { results, success: true, meta: { changes: 0 } };
  }

  run() {
    const { changes } = this.db.prepare(this.sql).run(...this.params);
    return Promise.resolve({ results: [], success: true, meta: { changes: Number(changes) } });
  }
}

export class SqliteD1 {
  readonly db = new DatabaseSync(':memory:');
  /** Nombre de transactions de `batch` (tests). */
  batches = 0;

  constructor() {
    const dir = join(import.meta.dirname, '..', 'migrations');
    for (const file of readdirSync(dir).sort()) this.db.exec(readFileSync(join(dir, file), 'utf8'));
  }

  prepare(sql: string) {
    return new Statement(this.db, sql);
  }

  /** Comme D1 : les requêtes d'un lot forment une transaction, annulée à la moindre erreur. */
  async batch(statements: Statement[]) {
    this.batches += 1;
    this.db.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
