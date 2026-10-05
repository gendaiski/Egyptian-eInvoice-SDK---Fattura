import { env } from '../env';
import { MIGRATIONS } from './migrations';

/** The minimal SQL surface the server uses. Implemented by node-postgres and by PGlite. */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Runs fn in a transaction; the callback receives a Db bound to the transaction. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  kind: 'postgres' | 'pglite';
}

let instance: Promise<Db> | null = null;

export function getDb(): Promise<Db> {
  if (!instance) instance = open().then(async (db) => { await migrate(db); return db; });
  return instance;
}

/** For tests: use a fresh in-memory database. */
export async function resetDb(): Promise<Db> {
  if (instance) await (await instance).close().catch(() => {});
  instance = null;
  return getDb();
}

async function open(): Promise<Db> {
  const { DATABASE_URL, PGLITE_DIR } = env();
  if (DATABASE_URL) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: DATABASE_URL, max: 5, ssl: /sslmode=require|neon|supabase/.test(DATABASE_URL) ? { rejectUnauthorized: false } : undefined });
    const wrap = (c: { query: (s: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Omit<Db, 'tx' | 'close' | 'kind'> => ({
      query: async <T,>(sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as T[],
    });
    return {
      kind: 'postgres',
      ...wrap(pool),
      async tx(fn) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const db: Db = { kind: 'postgres', ...wrap(client), tx: (f) => f(db), close: async () => {} };
          const out = await fn(db);
          await client.query('COMMIT');
          return out;
        } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
      },
      close: () => pool.end(),
    };
  }
  const { PGlite } = await import('@electric-sql/pglite');
  const pglite = PGLITE_DIR === 'memory' ? new PGlite() : new PGlite(PGLITE_DIR);
  await pglite.waitReady;
  let queue: Promise<unknown> = Promise.resolve();
  const db: Db = {
    kind: 'pglite',
    query: async <T,>(sql: string, params: unknown[] = []) => (await pglite.query(sql, params)).rows as T[],
    // PGlite is single-connection: serialise transactions so they never interleave.
    tx: (fn) => {
      const run = queue.then(() => pglite.transaction(async (t) => fn({
        kind: 'pglite', query: async <T,>(s: string, p: unknown[] = []) => (await t.query(s, p)).rows as T[], tx: (f) => f(db), close: async () => {},
      })));
      queue = run.catch(() => {});
      return run;
    },
    close: () => pglite.close(),
  };
  return db;
}

async function migrate(db: Db) {
  await db.query('CREATE TABLE IF NOT EXISTS schema_migrations (id INT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
  const done = new Set((await db.query<{ id: number }>('SELECT id FROM schema_migrations')).map((r) => r.id));
  for (const [i, sql] of MIGRATIONS.entries()) {
    if (done.has(i + 1)) continue;
    await db.tx(async (t) => {
      for (const stmt of sql.split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)) await t.query(stmt);
      await t.query('INSERT INTO schema_migrations (id) VALUES ($1)', [i + 1]);
    });
  }
}
