import { Hono, type Context } from 'hono';
import { requireTenant } from '../auth/session';
import { getDb } from '../db/client';
import { encrypt, newId, sha256, token } from '../crypto';
import { etaFor } from '../eta';
import { EtaApiError } from '../eta/types';
import { HttpError } from '../http';
import { repo } from '../repo';
import { changeState, completeSigning, pollDocuments, recordPayment, refreshCodes, requestCodes, runRecurring, submitDocuments, syncReceived } from '../services/documents';
import { generateTestCertificate } from '../signing/testCert';
import { WEBHOOK_EVENTS } from '../services/webhooks';
import { S } from './validators';

export const actions = new Hono();
const body = async (c: Context) => { try { return await c.req.json(); } catch { return {}; } };
const ip = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? '';

/* Documents */
actions.post('/documents/submit', async (c) => {
  const u = requireTenant(c, { write: true });
  const { ids } = await body(c);
  if (!Array.isArray(ids) || !ids.length || ids.length > 100) throw new HttpError(422, 'invalid_ids', 'Send 1–100 document ids.');
  const res = await submitDocuments(await getDb(), u.tenantId, ids.map(String), u.name);
  await repo(await getDb()).audit(u.email, 'document.submit', `${ids.length} document(s)`, u.tenantId, ip(c));
  return c.json(res);
});
actions.post('/documents/:id/refresh', async (c) => { const u = requireTenant(c); return c.json({ updated: await pollDocuments(await getDb(), u.tenantId, [c.req.param('id')]) }); });
for (const action of ['cancel', 'reject'] as const) {
  actions.post(`/documents/:id/${action}`, async (c) => {
    const u = requireTenant(c, { write: true });
    const { reason } = S.reason.parse(await body(c));
    const d = await changeState(await getDb(), u.tenantId, c.req.param('id'), action, reason, u.name);
    await repo(await getDb()).audit(u.email, `document.${action}`, d.internalID, u.tenantId, ip(c));
    return c.json(d);
  });
}
for (const action of ['decline-cancellation', 'accept-cancellation', 'decline-rejection'] as const) {
  actions.post(`/documents/:id/${action}`, async (c) => { const u = requireTenant(c, { write: true }); return c.json(await changeState(await getDb(), u.tenantId, c.req.param('id'), action, undefined, u.name)); });
}
actions.post('/documents/:id/payments', async (c) => {
  const u = requireTenant(c, { write: true });
  return c.json(await recordPayment(await getDb(), u.tenantId, c.req.param('id'), S.payment.parse(await body(c)), u.name));
});
actions.get('/documents/:id/eta-pdf', async (c) => {
  const u = requireTenant(c);
  const db = await getDb();
  const d = await repo(db).doc(u.tenantId, c.req.param('id'));
  if (!d?.uuid) throw new HttpError(404, 'not_found', 'Document not submitted.');
  const pdf = await (await etaFor(db, u.tenantId)).getDocumentPdf(d.uuid);
  return new Response(Buffer.from(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${d.internalID}.pdf"` } });
});

/* Recurring */
actions.post('/recurring/:id/run', async (c) => { const u = requireTenant(c, { write: true }); return c.json(await runRecurring(await getDb(), u.tenantId, c.req.param('id'), u.name)); });

/* Items & codes */
actions.post('/items/request-codes', async (c) => { const u = requireTenant(c, { write: true }); const { ids } = await body(c); return c.json(await requestCodes(await getDb(), u.tenantId, (ids ?? []).map(String))); });
actions.post('/items/refresh-codes', async (c) => { const u = requireTenant(c); return c.json({ changed: await refreshCodes(await getDb(), u.tenantId) }); });

/* Received documents */
actions.post('/received/sync', async (c) => { const u = requireTenant(c); return c.json(await syncReceived(await getDb(), u.tenantId)); });

/* Notifications */
actions.post('/notices/read-all', async (c) => {
  const u = requireTenant(c);
  const db = await getDb();
  await db.query("UPDATE records SET data = jsonb_set(data, '{read}', 'true') WHERE tenant_id = $1 AND kind = 'notices'", [u.tenantId]);
  return c.json({ ok: true });
});

/* Onboarding */
actions.post('/onboarding/complete', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const db = await getDb();
  const cfg = await repo(db).config(u.tenantId);
  if (!/^\d{9}$/.test(cfg.company.rin)) throw new HttpError(422, 'rin_required', 'Add your 9-digit tax registration number first.');
  await repo(db).saveConfig(u.tenantId, { onboarded: true });
  return c.json({ ok: true });
});

/* ETA connection */
actions.post('/integration/secret', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const { secret } = await body(c);
  if (typeof secret !== 'string' || secret.length < 8) throw new HttpError(422, 'bad_secret', 'Enter the client secret from the ETA portal.');
  const db = await getDb();
  const r = repo(db);
  const cfg = await r.config(u.tenantId);
  await r.saveConfig(u.tenantId, { secretEnc: encrypt(secret), integration: { ...cfg.integration, secretSet: true, status: 'not_configured' } });
  await db.query('DELETE FROM eta_tokens WHERE tenant_id = $1', [u.tenantId]);
  await r.audit(u.email, 'integration.update_credentials', cfg.integration.env, u.tenantId, ip(c));
  return c.json({ ok: true });
});
actions.post('/integration/test', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const db = await getDb();
  const r = repo(db);
  const cfg = await r.config(u.tenantId);
  const started = Date.now();
  try {
    const eta = await etaFor(db, u.tenantId);
    await eta.login();
    const types = await eta.getDocumentTypes();
    await r.saveConfig(u.tenantId, { integration: { ...cfg.integration, status: 'connected', lastTokenAt: new Date().toISOString() } });
    return c.json({ ok: true, ms: Date.now() - started, env: cfg.integration.env, documentTypes: types });
  } catch (e) {
    await r.saveConfig(u.tenantId, { integration: { ...cfg.integration, status: 'error' } });
    throw new HttpError(e instanceof EtaApiError ? 502 : 400, 'eta_connection_failed', (e as Error).message);
  }
});

/* Signing */
actions.post('/signing/test-certificate', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const db = await getDb();
  const r = repo(db);
  const cfg = await r.config(u.tenantId);
  if (!/^\d{9}$/.test(cfg.company.rin)) throw new HttpError(422, 'rin_required', 'Add your tax registration number before generating a certificate.');
  const tc = generateTestCertificate(cfg.company.name, cfg.company.rin);
  await r.saveConfig(u.tenantId, { keyEnc: encrypt(tc.keyPem), signing: { ...cfg.signing, method: 'test-certificate', certificate: tc.info, certificatePem: tc.certPem } });
  return c.json({ ok: true, certificate: tc.info });
});
actions.post('/signing/agents', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const db = await getDb();
  const { name } = await body(c);
  const t = token('fat_agent', 32);
  const id = newId('ag');
  await db.query('INSERT INTO agents (id, tenant_id, name, token_hash) VALUES ($1,$2,$3,$4)', [id, u.tenantId, String(name ?? 'Signer'), sha256(t)]);
  await repo(db).audit(u.email, 'signer.paired', String(name ?? id), u.tenantId, ip(c));
  return c.json({ id, token: t, note: 'Shown once. Paste it into Fatura Signer.' }, 201);
});
actions.get('/signing/agents', async (c) => {
  const u = requireTenant(c);
  return c.json(await (await getDb()).query('SELECT id, name, version, host, last_seen, created_at, revoked FROM agents WHERE tenant_id = $1 ORDER BY created_at DESC', [u.tenantId]));
});
actions.delete('/signing/agents/:id', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  await (await getDb()).query('UPDATE agents SET revoked = true WHERE id = $1 AND tenant_id = $2', [c.req.param('id'), u.tenantId]);
  return c.json({ ok: true });
});

/* Integration API keys & webhooks */
actions.get('/api-keys', async (c) => { const u = requireTenant(c, { roles: ['Owner', 'Admin'] }); return c.json(await (await getDb()).query('SELECT id, name, prefix, last_used, created_at, revoked FROM api_keys WHERE tenant_id = $1 ORDER BY created_at DESC', [u.tenantId])); });
actions.post('/api-keys', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const { name } = await body(c);
  const key = token('fat_live', 32);
  const id = newId('key');
  await (await getDb()).query('INSERT INTO api_keys (id, tenant_id, name, prefix, key_hash, created_by) VALUES ($1,$2,$3,$4,$5,$6)', [id, u.tenantId, String(name ?? 'API key'), key.slice(0, 13), sha256(key), u.email]);
  await repo(await getDb()).audit(u.email, 'api_key.create', String(name ?? id), u.tenantId, ip(c));
  return c.json({ id, key, note: 'Shown once. Store it in your ERP’s secret store.' }, 201);
});
actions.delete('/api-keys/:id', async (c) => { const u = requireTenant(c, { roles: ['Owner', 'Admin'] }); await (await getDb()).query('UPDATE api_keys SET revoked = true WHERE id = $1 AND tenant_id = $2', [c.req.param('id'), u.tenantId]); return c.json({ ok: true }); });
actions.get('/webhooks', async (c) => { const u = requireTenant(c, { roles: ['Owner', 'Admin'] }); return c.json(await (await getDb()).query('SELECT id, url, events, active, created_at FROM webhooks WHERE tenant_id = $1', [u.tenantId])); });
actions.post('/webhooks', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const { url, events } = await body(c);
  if (typeof url !== 'string' || !/^https:\/\//.test(url)) throw new HttpError(422, 'bad_url', 'Webhook URLs must use https.');
  const ev = Array.isArray(events) && events.length ? events.map(String) : ['*'];
  if (ev.some((e) => e !== '*' && !(WEBHOOK_EVENTS as readonly string[]).includes(e))) throw new HttpError(422, 'bad_event', `Events must be among: ${WEBHOOK_EVENTS.join(', ')}`);
  const secret = token('whsec', 24);
  const id = newId('wh');
  await (await getDb()).query('INSERT INTO webhooks (id, tenant_id, url, secret_enc, events) VALUES ($1,$2,$3,$4,$5)', [id, u.tenantId, url, encrypt(secret), JSON.stringify(ev)]);
  return c.json({ id, secret, note: 'Verify X-Fatura-Signature with this secret. Shown once.' }, 201);
});
actions.delete('/webhooks/:id', async (c) => { const u = requireTenant(c, { roles: ['Owner', 'Admin'] }); await (await getDb()).query('DELETE FROM webhooks WHERE id = $1 AND tenant_id = $2', [c.req.param('id'), u.tenantId]); return c.json({ ok: true }); });

/* Signer agent protocol — authenticated with the agent token, not a user session. */
export const signer = new Hono<{ Variables: { agent: { id: string; tenant_id: string } } }>();
signer.use('*', async (c, next) => {
  const t = c.req.header('authorization')?.match(/^Agent (fat_agent_[\w-]+)$/)?.[1];
  if (!t) throw new HttpError(401, 'agent_unauthenticated', 'Send Authorization: Agent <token>.');
  const [a] = await (await getDb()).query<{ id: string; tenant_id: string }>('SELECT id, tenant_id FROM agents WHERE token_hash = $1 AND NOT revoked', [sha256(t)]);
  if (!a) throw new HttpError(401, 'agent_revoked', 'This signer token is not valid. Pair the signer again.');
  c.set('agent', a);
  await next();
});
signer.post('/heartbeat', async (c) => {
  const a = c.get('agent');
  const b = await body(c);
  const db = await getDb();
  await db.query('UPDATE agents SET last_seen = now(), version = $2, host = $3 WHERE id = $1', [a.id, String(b.version ?? ''), String(b.host ?? '')]);
  if (b.certificate?.subject) {
    const r = repo(db);
    const cfg = await r.config(a.tenant_id);
    await r.saveConfig(a.tenant_id, { signing: { ...cfg.signing, method: 'usb-token', certificate: { subject: String(b.certificate.subject), issuer: String(b.certificate.issuer ?? ''), serial: String(b.certificate.serial ?? ''), expires: String(b.certificate.expires ?? '') } } });
  }
  return c.json({ ok: true });
});
/** Long-poll for work: returns pending jobs (claimed atomically) or an empty list after `wait` seconds. */
signer.get('/jobs', async (c) => {
  const a = c.get('agent');
  const db = await getDb();
  const wait = Math.min(25, Math.max(0, Number(c.req.query('wait') ?? 0)));
  const deadline = Date.now() + wait * 1000;
  await db.query('UPDATE agents SET last_seen = now() WHERE id = $1', [a.id]);
  for (;;) {
    const jobs = await db.query<{ id: string; items: unknown }>("UPDATE signing_jobs SET status = 'claimed', claimed_at = now() WHERE id IN (SELECT id FROM signing_jobs WHERE tenant_id = $1 AND (status = 'pending' OR (status = 'claimed' AND claimed_at < now() - interval '2 minutes')) ORDER BY created_at LIMIT 5) RETURNING id, items", [a.tenant_id]);
    if (jobs.length || Date.now() >= deadline) return c.json({ jobs });
    await new Promise((r) => setTimeout(r, 1000));
  }
});
signer.post('/jobs/:id', async (c) => {
  const a = c.get('agent');
  const b = await body(c);
  const db = await getDb();
  if (b.error) {
    await db.query("UPDATE signing_jobs SET status = 'failed', error = $3, completed_at = now() WHERE id = $1 AND tenant_id = $2", [c.req.param('id'), a.tenant_id, String(b.error)]);
    await repo(db).notify(a.tenant_id, 'bad', { en: `Signing failed on the USB token: ${b.error}`, ar: 'فشل التوقيع على التوكن.' }, '/app/settings/signing');
    return c.json({ ok: true });
  }
  if (!Array.isArray(b.signatures)) throw new HttpError(422, 'invalid_body', 'signatures[] is required.');
  return c.json(await completeSigning(db, a.tenant_id, c.req.param('id'), b.signatures));
});
