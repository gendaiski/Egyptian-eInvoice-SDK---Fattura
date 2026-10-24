import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

let pending;
export function getDb() {
  if (!pending) pending = open().catch((error) => { pending = undefined; throw error; });
  return pending;
}

async function open() {
  let query, close;
  if (process.env.MA_DATABASE_URL) {
    const { default: pg } = await import('pg');
    const pool = new pg.Pool({ connectionString: process.env.MA_DATABASE_URL, max: 5 });
    query = async (sql, args = []) => (await pool.query(sql, args)).rows;
    close = () => pool.end();
  } else {
    if (process.env.VERCEL) throw new Error('MA_DATABASE_URL is required on ephemeral hosting.');
    const { PGlite } = await import('@electric-sql/pglite');
    const dataDir = resolve(process.env.MA_DATA_DIR || './data');
    await mkdir(dataDir, { recursive: true });
    const db = new PGlite(dataDir);
    await db.waitReady;
    query = async (sql, args = []) => (await db.query(sql, args)).rows;
    close = () => db.close();
  }
  await query(`CREATE TABLE IF NOT EXISTS ma_users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('owner','admin','analyst','viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query("CREATE UNIQUE INDEX IF NOT EXISTS ma_one_owner ON ma_users(role) WHERE role = 'owner'");
  await query(`CREATE TABLE IF NOT EXISTS ma_deals (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, target TEXT NOT NULL,
    stage TEXT NOT NULL DEFAULT 'screening', created_by TEXT NOT NULL REFERENCES ma_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS ma_access (
    deal_id TEXT NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES ma_users(id) ON DELETE CASCADE,
    can_write BOOLEAN NOT NULL DEFAULT false, granted_by TEXT NOT NULL REFERENCES ma_users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(deal_id,user_id)
  )`);
  await query(`CREATE TABLE IF NOT EXISTS ma_documents (
    id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
    filename TEXT NOT NULL, mime_type TEXT NOT NULL, size_bytes INT NOT NULL,
    checksum TEXT NOT NULL, content_enc TEXT NOT NULL,
    uploaded_by TEXT NOT NULL REFERENCES ma_users(id), created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS ma_findings (
    id TEXT PRIMARY KEY, deal_id TEXT NOT NULL REFERENCES ma_deals(id) ON DELETE CASCADE,
    title TEXT NOT NULL, domain TEXT NOT NULL, severity TEXT NOT NULL, origin TEXT NOT NULL,
    summary TEXT NOT NULL, document_id TEXT REFERENCES ma_documents(id), source_quote TEXT,
    source_location TEXT, quote_matched BOOLEAN NOT NULL DEFAULT false,
    review_status TEXT NOT NULL DEFAULT 'draft', created_by TEXT NOT NULL REFERENCES ma_users(id),
    reviewed_by TEXT REFERENCES ma_users(id), reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query(`CREATE TABLE IF NOT EXISTS ma_audit (
    id TEXT PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES ma_users(id),
    action TEXT NOT NULL, deal_id TEXT REFERENCES ma_deals(id) ON DELETE CASCADE,
    target TEXT, at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await query('CREATE INDEX IF NOT EXISTS ma_audit_deal ON ma_audit(deal_id, at DESC)');
  return { query, close, kind: process.env.MA_DATABASE_URL ? 'postgres' : 'pglite' };
}
