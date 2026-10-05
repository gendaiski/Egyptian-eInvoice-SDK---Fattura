import type { Db } from './db/client';
import type { Company, Doc, Integration, Signing } from '../../src/store/model';
import { newId } from './crypto';

/** Kinds stored in the generic per-tenant `records` table. Documents have their own table. */
export const RECORD_KINDS = ['customers', 'items', 'recurring', 'submissions', 'receipts', 'notices'] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
/** Kinds stored in the platform-wide `platform` table. */
export const PLATFORM_KINDS = ['plans', 'invoices', 'leads', 'refs', 'api'] as const;
export type PlatformKind = (typeof PLATFORM_KINDS)[number];

export type ServerIntegration = Omit<Integration, 'env'> & { env: 'simulator' | 'preprod' | 'production' };
export type ServerSigning = Omit<Signing, 'method'> & { method: Signing['method'] | 'test-certificate'; certificatePem?: string };
export interface TenantConfig {
  company: Company; integration: ServerIntegration; signing: ServerSigning;
  settings: { numbering: Record<string, { pattern: string; next: number }>; personIdThreshold: number; defaultTerms: string; autoEmail: boolean };
  onboarded: boolean;
}

export const repo = (db: Db) => ({
  async config(tenantId: string): Promise<TenantConfig & { secretEnc: string | null; keyEnc: string | null }> {
    const [r] = await db.query<{ company: Company; integration: ServerIntegration; signing: ServerSigning; settings: TenantConfig['settings']; onboarded: boolean; eta_client_secret_enc: string | null; signing_key_enc: string | null }>('SELECT * FROM tenant_config WHERE tenant_id = $1', [tenantId]);
    if (!r) throw new Error(`No configuration for tenant ${tenantId}`);
    return { company: r.company, integration: r.integration, signing: r.signing, settings: r.settings, onboarded: r.onboarded, secretEnc: r.eta_client_secret_enc, keyEnc: r.signing_key_enc };
  },
  async saveConfig(tenantId: string, part: Partial<Record<'company' | 'integration' | 'signing' | 'settings', unknown>> & { onboarded?: boolean; secretEnc?: string | null; keyEnc?: string | null }) {
    const cols: string[] = []; const vals: unknown[] = [];
    const add = (col: string, v: unknown) => { vals.push(v); cols.push(`${col} = $${vals.length + 1}`); };
    for (const k of ['company', 'integration', 'signing', 'settings'] as const) if (part[k] !== undefined) add(k, JSON.stringify(part[k]));
    if (part.onboarded !== undefined) add('onboarded', part.onboarded);
    if (part.secretEnc !== undefined) add('eta_client_secret_enc', part.secretEnc);
    if (part.keyEnc !== undefined) add('signing_key_enc', part.keyEnc);
    if (cols.length) await db.query(`UPDATE tenant_config SET ${cols.join(', ')} WHERE tenant_id = $1`, [tenantId, ...vals]);
  },

  async list<T>(tenantId: string, kind: RecordKind): Promise<T[]> {
    return (await db.query<{ data: T }>('SELECT data FROM records WHERE tenant_id = $1 AND kind = $2 ORDER BY updated_at DESC', [tenantId, kind])).map((r) => r.data);
  },
  async get<T>(tenantId: string, kind: RecordKind, id: string): Promise<T | undefined> {
    const [r] = await db.query<{ data: T }>('SELECT data FROM records WHERE tenant_id = $1 AND kind = $2 AND id = $3', [tenantId, kind, id]);
    return r?.data;
  },
  async put(tenantId: string, kind: RecordKind, id: string, data: unknown) {
    await db.query('INSERT INTO records (tenant_id, kind, id, data) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id, kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', [tenantId, kind, id, JSON.stringify(data)]);
  },
  async remove(tenantId: string, kind: RecordKind, id: string) {
    await db.query('DELETE FROM records WHERE tenant_id = $1 AND kind = $2 AND id = $3', [tenantId, kind, id]);
  },

  async docs(tenantId: string, where: { status?: string[]; direction?: string } = {}): Promise<Doc[]> {
    const conds = ['tenant_id = $1']; const vals: unknown[] = [tenantId];
    if (where.status) { vals.push(where.status); conds.push(`status = ANY($${vals.length})`); }
    if (where.direction) { vals.push(where.direction); conds.push(`direction = $${vals.length}`); }
    return (await db.query<{ data: Doc }>(`SELECT data FROM documents WHERE ${conds.join(' AND ')} ORDER BY issued_at DESC`, vals)).map((r) => r.data);
  },
  async doc(tenantId: string, id: string): Promise<Doc | undefined> {
    const [r] = await db.query<{ data: Doc }>('SELECT data FROM documents WHERE tenant_id = $1 AND id = $2', [tenantId, id]);
    return r?.data;
  },
  async docByUuid(tenantId: string, uuid: string): Promise<Doc | undefined> {
    const [r] = await db.query<{ data: Doc }>('SELECT data FROM documents WHERE tenant_id = $1 AND eta_uuid = $2', [tenantId, uuid]);
    return r?.data;
  },
  async putDoc(tenantId: string, d: Doc) {
    await db.query(
      `INSERT INTO documents (tenant_id, id, direction, status, internal_id, eta_uuid, issued_at, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (tenant_id, id) DO UPDATE SET direction = EXCLUDED.direction, status = EXCLUDED.status, internal_id = EXCLUDED.internal_id, eta_uuid = EXCLUDED.eta_uuid, issued_at = EXCLUDED.issued_at, data = EXCLUDED.data, updated_at = now()`,
      [tenantId, d.id, d.direction, d.status, d.internalID, d.uuid ?? null, d.issuedAt, JSON.stringify(d)],
    );
  },
  async deleteDoc(tenantId: string, id: string) { await db.query("DELETE FROM documents WHERE tenant_id = $1 AND id = $2 AND status = 'Draft'", [tenantId, id]); },

  async platform<T>(kind: PlatformKind | string): Promise<T[]> {
    return (await db.query<{ data: T }>('SELECT data FROM platform WHERE kind = $1 ORDER BY updated_at DESC, id', [kind])).map((r) => r.data);
  },
  async platformOne<T>(kind: string, id: string): Promise<T | undefined> {
    const [r] = await db.query<{ data: T }>('SELECT data FROM platform WHERE kind = $1 AND id = $2', [kind, id]);
    return r?.data;
  },
  async putPlatform(kind: string, id: string, data: unknown) {
    await db.query('INSERT INTO platform (kind, id, data) VALUES ($1,$2,$3) ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', [kind, id, JSON.stringify(data)]);
  },

  async audit(actor: string, action: string, target: string, tenantId?: string | null, ip?: string) {
    await db.query('INSERT INTO audit (id, actor, tenant_id, action, target, ip) VALUES ($1,$2,$3,$4,$5,$6)', [newId('a'), actor, tenantId ?? null, action, target, ip ?? null]);
  },

  async notify(tenantId: string, tone: 'ok' | 'bad' | 'warn' | 'info', text: { en: string; ar: string }, to?: string) {
    const id = newId('n');
    await this.put(tenantId, 'notices', id, { id, at: new Date().toISOString(), tone, text, to, read: false });
  },
});

export type Repo = ReturnType<typeof repo>;
