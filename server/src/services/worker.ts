import type { Db } from '../db/client';
import { repo } from '../repo';
import { pollDocuments, refreshCodes, runDueRecurring, syncReceived } from './documents';
import { deliverOutbox } from './webhooks';

/**
 * One pass of background work. Called every minute by the Node server, or by a scheduler hitting
 * POST /api/cron/tick on serverless. Each tenant step is isolated so one failing tenant never blocks the rest.
 */
export async function tick(db: Db) {
  const tenants = await db.query<{ tenant_id: string }>("SELECT c.tenant_id FROM tenant_config c JOIN tenants t ON t.id = c.tenant_id WHERE t.status <> 'suspended' AND (c.integration->>'clientId') <> ''");
  const report: Record<string, unknown> = {};
  for (const { tenant_id } of tenants) {
    const out: Record<string, unknown> = {};
    for (const [name, fn] of [
      ['polled', () => pollDocuments(db, tenant_id)],
      ['recurring', () => runDueRecurring(db, tenant_id)],
      ['received', () => syncReceived(db, tenant_id)],
      ['codes', () => refreshCodes(db, tenant_id)],
    ] as const) {
      try { out[name] = await fn(); } catch (e) { out[name] = `error: ${(e as Error).message}`; }
    }
    report[tenant_id] = out;
  }
  const expired = await db.query<{ tenant_id: string; items: { docId: string }[] }>("UPDATE signing_jobs SET status = 'expired', error = 'Signer did not respond within 30 minutes' WHERE status IN ('pending','claimed') AND created_at < now() - interval '30 minutes' RETURNING tenant_id, items");
  for (const j of expired) {
    const r = repo(db);
    for (const it of j.items) {
      const d = await r.doc(j.tenant_id, it.docId);
      if (d?.status === 'Signing') { d.status = 'Draft'; d.events.push({ at: new Date().toISOString(), type: 'signing_expired', by: 'Fatura', note: 'The signer did not respond. Submit again when it is online.' }); await r.putDoc(j.tenant_id, d); }
    }
    await r.notify(j.tenant_id, 'warn', { en: 'Signing timed out — the documents are back in drafts.', ar: 'انتهت مهلة التوقيع — عادت المستندات إلى المسودات.' }, '/app/documents?status=Draft');
  }
  report.webhooks = await deliverOutbox(db).catch((e) => `error: ${(e as Error).message}`);
  await repo(db).putPlatform('worker', 'last_tick', { at: new Date().toISOString(), report });
  return report;
}
