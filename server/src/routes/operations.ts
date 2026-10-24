import { Hono } from 'hono';
import { z } from 'zod';
import { requireStaff, requireTenant } from '../auth/session';
import { getDb } from '../db/client';
import { env } from '../env';
import { HttpError } from '../http';
import { repo } from '../repo';
import { pollDocuments } from '../services/documents';
import { settlePlatformInvoice } from '../services/platformBilling';

export const operations = new Hono();

operations.get('/status', async (c) => {
  requireStaff(c);
  const db = await getDb();
  const [counts] = await db.query<{ tenants: number; documents: number; submitted: number }>(`SELECT
    (SELECT count(*)::int FROM tenants) AS tenants,
    (SELECT count(*)::int FROM documents) AS documents,
    (SELECT count(*)::int FROM documents WHERE status = 'Submitted') AS submitted`);
  const [queues] = await db.query<{ webhooks: number; signing: number }>(`SELECT
    (SELECT count(*)::int FROM outbox WHERE delivered_at IS NULL AND attempts < 8) AS webhooks,
    (SELECT count(*)::int FROM signing_jobs WHERE status IN ('pending', 'claimed')) AS signing`);
  const [worker] = await db.query<{ data: { at: string } }>("SELECT data FROM platform WHERE kind = 'worker' AND id = 'last_tick'");
  return c.json({ at: new Date().toISOString(), database: db.kind, persistentDatabase: db.kind === 'postgres' || (!process.env.VERCEL && env().PGLITE_DIR !== 'memory'), counts, queues, lastWorkerTick: worker?.data.at ?? null, productionSubmissionEnabled: env().ETA_PRODUCTION_SUBMISSION_ENABLED === 'true', paymentSimulatorEnabled: env().PAYMENT_SIMULATOR_ENABLED === 'true', etaLiveVerified: false, paymentProviderConfigured: false });
});

operations.post('/eta/retry-simulator', async (c) => {
  const u = requireStaff(c, ['Super admin', 'Support']);
  const parsed = z.object({ tenantId: z.string().min(1) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, 'invalid_body', 'Select a simulator tenant.');
  const db = await getDb();
  const [cfg] = await db.query<{ integration: { env: string } }>('SELECT integration FROM tenant_config WHERE tenant_id = $1', [parsed.data.tenantId]);
  if (!cfg) throw new HttpError(404, 'not_found', 'Tenant not found.');
  if (cfg.integration.env !== 'simulator') throw new HttpError(409, 'live_eta_blocked', 'This control only retries simulator documents. Live ETA needs its own approved run.');
  const completed = await pollDocuments(db, parsed.data.tenantId);
  await repo(db).audit(u.email, 'admin.eta.simulator_retry', `${parsed.data.tenantId}: ${completed}`, parsed.data.tenantId);
  return c.json({ completed });
});

operations.get('/audit/export', async (c) => {
  const u = requireStaff(c, ['Super admin', 'Support', 'Finance']);
  const db = await getDb();
  const rows = await db.query<{ at: string; actor: string; action: string; target: string; tenant_id: string | null; ip: string | null }>('SELECT at, actor, action, target, tenant_id, ip FROM audit ORDER BY at DESC LIMIT 10000');
  await repo(db).audit(u.email, 'admin.audit.export', `${rows.length} rows`);
  c.header('Content-Disposition', `attachment; filename="fatura-audit-${new Date().toISOString().slice(0, 10)}.json"`);
  c.header('Cache-Control', 'no-store');
  return c.json({ exportedAt: new Date().toISOString(), limit: 10000, rows });
});

operations.get('/tenant/export', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const db = await getDb();
  const r = repo(db);
  const cfg = await r.config(u.tenantId);
  const [tenant] = await db.query<{ data: Record<string, unknown> }>('SELECT data FROM tenants WHERE id = $1', [u.tenantId]);
  const data = {
    exportedAt: new Date().toISOString(), format: 'fatura-beta-json-v1',
    tenant: tenant?.data, company: cfg.company,
    documents: await r.docs(u.tenantId), customers: await r.list(u.tenantId, 'customers'),
    items: await r.list(u.tenantId, 'items'), recurring: await r.list(u.tenantId, 'recurring'),
    submissions: await r.list(u.tenantId, 'submissions'), receipts: await r.list(u.tenantId, 'receipts'),
  };
  await r.audit(u.email, 'tenant.data_export', u.tenantId, u.tenantId);
  c.header('Content-Disposition', `attachment; filename="fatura-data-${new Date().toISOString().slice(0, 10)}.json"`);
  c.header('Cache-Control', 'no-store');
  return c.json(data);
});

operations.post('/billing/:id/record-payment', async (c) => {
  const u = requireStaff(c, ['Super admin', 'Finance']);
  const parsed = z.object({ reference: z.string().trim().min(3).max(120), method: z.enum(['bank-transfer', 'cash', 'external-provider']) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, 'invalid_body', 'A payment method and reference are required.');
  const db = await getDb();
  const r = repo(db);
  const id = c.req.param('id');
  const invoice = await r.platformOne<{ id: string; number: string; status: string; tenantId: string; amount: number; vat: number }>('invoices', id);
  if (!invoice) throw new HttpError(404, 'not_found', 'Invoice not found.');
  if (invoice.status === 'paid') throw new HttpError(409, 'already_paid', 'Invoice is already paid.');
  if (!['open', 'overdue'].includes(invoice.status)) throw new HttpError(409, 'not_payable', 'Invoice cannot be settled in its current state.');
  await db.tx(async (tx) => {
    await settlePlatformInvoice(tx, id, { ...parsed.data, recordedAt: new Date().toISOString(), recordedBy: u.email, amount: invoice.amount + invoice.vat });
    await tx.query("UPDATE tenants SET status = 'active', data = jsonb_set(data, '{status}', '\"active\"') WHERE id = $1 AND status = 'past_due'", [invoice.tenantId]);
    await repo(tx).audit(u.email, 'billing.payment_recorded', `${invoice.number}: ${parsed.data.reference}`, invoice.tenantId);
  });
  return c.json({ ok: true, invoiceId: id, status: 'paid' });
});

const billingModel = z.enum(['monthly', 'yearly', 'one-time', 'installments']);
operations.post('/billing/change-request', async (c) => {
  const u = requireTenant(c, { roles: ['Owner'] });
  const parsed = z.object({ model: billingModel }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, 'invalid_body', 'Select a valid billing model.');
  const db = await getDb();
  const [tenant] = await db.query<{ data: Record<string, unknown> }>('SELECT data FROM tenants WHERE id = $1', [u.tenantId]);
  if (!tenant) throw new HttpError(404, 'not_found', 'Tenant not found.');
  if (tenant.data.pendingBilling) throw new HttpError(409, 'request_pending', 'A billing change is already awaiting review.');
  const current = tenant.data.model === 'recurring' ? tenant.data.cycle : tenant.data.model;
  if (current === parsed.data.model) throw new HttpError(409, 'unchanged', 'This is already your billing model.');
  const pendingBilling = { model: parsed.data.model, requestedAt: new Date().toISOString(), requestedBy: u.email };
  await db.tx(async (tx) => {
    await tx.query('UPDATE tenants SET data = $2 WHERE id = $1', [u.tenantId, JSON.stringify({ ...tenant.data, pendingBilling })]);
    await repo(tx).audit(u.email, 'billing.change_requested', parsed.data.model, u.tenantId);
  });
  return c.json({ pendingBilling });
});

operations.post('/billing/change-request/:tenantId/approve', async (c) => {
  const u = requireStaff(c, ['Super admin', 'Finance']);
  const db = await getDb();
  const tenantId = c.req.param('tenantId');
  const [tenant] = await db.query<{ data: Record<string, unknown> }>('SELECT data FROM tenants WHERE id = $1', [tenantId]);
  if (!tenant) throw new HttpError(404, 'not_found', 'Tenant not found.');
  const pending = tenant.data.pendingBilling as { model: z.infer<typeof billingModel> } | undefined;
  if (!pending) throw new HttpError(409, 'no_request', 'No billing change is awaiting review.');
  const next: Record<string, unknown> = { ...tenant.data, model: pending.model === 'monthly' || pending.model === 'yearly' ? 'recurring' : pending.model, cycle: pending.model === 'monthly' || pending.model === 'yearly' ? pending.model : undefined };
  delete next.pendingBilling;
  await db.tx(async (tx) => {
    await tx.query('UPDATE tenants SET data = $2 WHERE id = $1', [tenantId, JSON.stringify(next)]);
    await repo(tx).audit(u.email, 'billing.change_approved', pending.model, tenantId);
  });
  return c.json({ ok: true, model: pending.model });
});
