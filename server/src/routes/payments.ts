import { Hono } from 'hono';
import { z } from 'zod';
import { requireTenant } from '../auth/session';
import { newId } from '../crypto';
import { getDb } from '../db/client';
import { env } from '../env';
import { HttpError } from '../http';
import { repo } from '../repo';
import { settlePlatformInvoice } from '../services/platformBilling';

export const payments = new Hono();
const enabled = () => env().PAYMENT_SIMULATOR_ENABLED === 'true';
const requireSimulator = () => { if (!enabled()) throw new HttpError(409, 'payment_simulator_disabled', 'Payment simulator is disabled on this server.'); };

payments.get('/providers', (c) => {
  requireTenant(c);
  return c.json({ providers: [
    { id: 'simulator', name: 'Fatura test payments', enabled: enabled(), movesMoney: false },
    { id: 'paymob', name: 'Paymob', enabled: false, movesMoney: true, reason: 'Awaiting verified sandbox API contract and account credentials.' },
    { id: 'fawry', name: 'Fawry', enabled: false, movesMoney: true, reason: 'Connector not configured.' },
    { id: 'bank-transfer', name: 'Bank transfer', enabled: false, movesMoney: false, reason: 'Use staff-recorded payment evidence after reconciliation.' },
  ] });
});

payments.post('/intents', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  requireSimulator();
  const parsed = z.object({ invoiceId: z.string().min(1), provider: z.literal('simulator') }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, 'invalid_body', 'Select a valid invoice and enabled provider.');
  const db = await getDb();
  const r = repo(db);
  const invoice = await r.platformOne<{ id: string; tenantId: string; status: string; amount: number; vat: number }>('invoices', parsed.data.invoiceId);
  if (!invoice || invoice.tenantId !== u.tenantId) throw new HttpError(404, 'not_found', 'Invoice not found.');
  if (!['open', 'overdue'].includes(invoice.status)) throw new HttpError(409, 'not_payable', 'Invoice is not open for payment.');
  const amountPiasters = Math.round((invoice.amount + invoice.vat) * 100);
  if (!Number.isSafeInteger(amountPiasters) || amountPiasters <= 0) throw new HttpError(409, 'bad_amount', 'Invoice amount is invalid.');
  const id = newId('pi');
  await db.query("INSERT INTO payment_intents (id, tenant_id, invoice_id, provider, status, amount_piasters) VALUES ($1,$2,$3,'simulator','pending',$4) ON CONFLICT (invoice_id) DO NOTHING", [id, u.tenantId, invoice.id, amountPiasters]);
  const [intent] = await db.query<{ id: string; status: string; amount_piasters: string; provider: string }>('SELECT id, status, amount_piasters, provider FROM payment_intents WHERE invoice_id = $1 AND tenant_id = $2', [invoice.id, u.tenantId]);
  if (intent.status === 'failed') await db.query("UPDATE payment_intents SET status = 'pending', amount_piasters = $2, updated_at = now() WHERE id = $1", [intent.id, amountPiasters]);
  await r.audit(u.email, 'payment.test_intent', invoice.id, u.tenantId);
  return c.json({ id: intent.id, invoiceId: invoice.id, provider: 'simulator', status: 'pending', amountPiasters, currency: 'EGP', movesMoney: false });
});

payments.post('/intents/:id/simulate', async (c) => {
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  requireSimulator();
  const parsed = z.object({ outcome: z.enum(['paid', 'failed']) }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) throw new HttpError(422, 'invalid_body', 'Select paid or failed.');
  const db = await getDb();
  const id = c.req.param('id');
  const [intent] = await db.query<{ id: string; invoice_id: string; status: string; amount_piasters: string }>('SELECT id, invoice_id, status, amount_piasters FROM payment_intents WHERE id = $1 AND tenant_id = $2', [id, u.tenantId]);
  if (!intent) throw new HttpError(404, 'not_found', 'Payment intent not found.');
  if (intent.status !== 'pending') throw new HttpError(409, 'already_resolved', 'Payment intent has already been resolved.');
  const invoice = await repo(db).platformOne<{ id: string; tenantId: string; number: string; status: string; amount: number; vat: number }>('invoices', intent.invoice_id);
  if (!invoice || invoice.tenantId !== u.tenantId) throw new HttpError(404, 'not_found', 'Invoice not found.');
  if (!['open', 'overdue'].includes(invoice.status)) throw new HttpError(409, 'not_payable', 'Invoice is not open for payment.');
  if (Math.round((invoice.amount + invoice.vat) * 100) !== Number(intent.amount_piasters)) throw new HttpError(409, 'amount_changed', 'Invoice amount changed since the payment intent was created.');
  const reference = `SIM-${intent.id}`;
  await db.tx(async (tx) => {
    const updated = await tx.query<{ id: string }>('UPDATE payment_intents SET status = $2, attempts = attempts + 1, provider_reference = $3, updated_at = now() WHERE id = $1 AND status = \'pending\' RETURNING id', [id, parsed.data.outcome, reference]);
    if (!updated.length) throw new HttpError(409, 'already_resolved', 'Payment intent has already been resolved.');
    if (parsed.data.outcome === 'paid') {
      await settlePlatformInvoice(tx, invoice.id, { method: 'simulator', reference, recordedAt: new Date().toISOString(), amount: Number(intent.amount_piasters) / 100 });
      await tx.query("UPDATE tenants SET status = 'active', data = jsonb_set(data, '{status}', '\"active\"') WHERE id = $1 AND status = 'past_due'", [u.tenantId]);
    }
    await repo(tx).audit(u.email, `payment.test_${parsed.data.outcome}`, reference, u.tenantId);
  });
  return c.json({ id, status: parsed.data.outcome, reference, movesMoney: false });
});
