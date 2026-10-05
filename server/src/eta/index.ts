import type { Db } from '../db/client';
import { decrypt } from '../crypto';
import { repo } from '../repo';
import { HttpEtaClient, type TokenStore } from './http';
import { SimulatorEta } from './simulator';
import type { EtaApi } from './types';

/** Token cache in the database so serverless instances share one ETA token per tenant and environment. */
const dbTokens = (db: Db, tenantId: string, envName: string): TokenStore => ({
  async get() {
    const [r] = await db.query<{ token: string; expires_at: string }>('SELECT token, expires_at FROM eta_tokens WHERE tenant_id = $1 AND env = $2', [tenantId, envName]);
    return r ? { token: decrypt(r.token), expiresAt: new Date(r.expires_at).getTime() } : null;
  },
  async set(token, expiresAt) {
    const { encrypt } = await import('../crypto');
    await db.query('INSERT INTO eta_tokens (tenant_id, env, token, expires_at) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id) DO UPDATE SET env = EXCLUDED.env, token = EXCLUDED.token, expires_at = EXCLUDED.expires_at', [tenantId, envName, encrypt(token), new Date(expiresAt).toISOString()]);
  },
});

/** The ETA client for a tenant's configured environment. */
export async function etaFor(db: Db, tenantId: string): Promise<EtaApi> {
  const cfg = await repo(db).config(tenantId);
  const envName = cfg.integration.env;
  if (envName === 'simulator') return new SimulatorEta(db, cfg.company.rin);
  if (!cfg.integration.clientId || !cfg.secretEnc) throw Object.assign(new Error('ETA credentials are not configured. Add the client ID and secret in Settings → ETA connection.'), { code: 'eta_not_configured' });
  return new HttpEtaClient(envName, { clientId: cfg.integration.clientId, clientSecret: decrypt(cfg.secretEnc) }, dbTokens(db, tenantId, envName));
}
