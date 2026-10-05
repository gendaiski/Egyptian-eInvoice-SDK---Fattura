import { Hono, type Context } from 'hono';
import type { Customer, Doc, DocLine, Item } from '../../../src/store/model';
import { docTotal } from '../../../src/store/model';
import { getDb } from '../db/client';
import { newId, sha256 } from '../crypto';
import { HttpError } from '../http';
import { repo } from '../repo';
import { changeState, saveDraft, submitDocuments } from '../services/documents';
import { S } from './validators';

/**
 * Integration API for ERPs and scripts: Authorization: Bearer fat_live_…
 * Idempotent document creation by internal_id. See docs/openapi.yaml.
 */
export const ext = new Hono<{ Variables: { tenantId: string; keyName: string } }>();

ext.use('*', async (c, next) => {
  const key = c.req.header('authorization')?.match(/^Bearer (fat_live_[\w-]+)$/)?.[1];
  if (!key) throw new HttpError(401, 'api_key_required', 'Send Authorization: Bearer <API key>. Create keys in Settings → API & webhooks.');
  const db = await getDb();
  const [k] = await db.query<{ id: string; tenant_id: string; name: string }>('SELECT id, tenant_id, name FROM api_keys WHERE key_hash = $1 AND NOT revoked', [sha256(key)]);
  if (!k) throw new HttpError(401, 'api_key_invalid', 'This API key is not valid or was revoked.');
  const [t] = await db.query<{ status: string }>('SELECT status FROM tenants WHERE id = $1', [k.tenant_id]);
  if (t?.status === 'suspended' && c.req.method !== 'GET') throw new HttpError(403, 'tenant_suspended', 'This account is suspended; read access only.');
  await db.query('UPDATE api_keys SET last_used = now() WHERE id = $1', [k.id]);
  c.set('tenantId', k.tenant_id); c.set('keyName', k.name);
  await next();
});

const view = (d: Doc) => ({
  id: d.id, internal_id: d.internalID, type: d.documentType, status: d.status, eta_uuid: d.uuid ?? null, eta_long_id: d.longId ?? null,
  issued_at: d.issuedAt, submitted_at: d.submittedAt ?? null, validated_at: d.validatedAt ?? null, total: docTotal(d),
  receiver: d.counterparty, validation_steps: d.steps ?? [], payment_plan: d.plan, installments: d.installments ?? [], payments: d.payments,
  public_url: d.uuid && d.longId ? `https://invoicing.eta.gov.eg/documents/${d.uuid}/share/${d.longId}` : null,
});

ext.get('/documents', async (c) => {
  const db = await getDb();
  const status = c.req.query('status');
  const docs = await repo(db).docs(c.get('tenantId'), { status: status ? status.split(',') : undefined, direction: c.req.query('direction') === 'received' ? 'received' : 'sent' });
  const from = c.req.query('issued_from'), to = c.req.query('issued_to');
  const list = docs.filter((d) => (!from || d.issuedAt >= from) && (!to || d.issuedAt <= to));
  const limit = Math.min(200, Number(c.req.query('limit') ?? 50)), offset = Number(c.req.query('offset') ?? 0);
  return c.json({ data: list.slice(offset, offset + limit).map(view), total: list.length, limit, offset });
});
ext.get('/documents/:id', async (c) => {
  const db = await getDb();
  const r = repo(db);
  const id = c.req.param('id');
  const d = (await r.doc(c.get('tenantId'), id)) ?? (await r.docByUuid(c.get('tenantId'), id)) ?? (await r.docs(c.get('tenantId'))).find((x) => x.internalID === id);
  if (!d) throw new HttpError(404, 'not_found', 'Document not found.');
  return c.json(view(d));
});

ext.post('/documents', async (c) => {
  const tenantId = c.get('tenantId');
  const b = S.ext.document.parse(await c.req.json().catch(() => ({})));
  const db = await getDb();
  const r = repo(db);
  if (b.internal_id) {
    const dup = (await r.docs(tenantId, { direction: 'sent' })).find((d) => d.internalID === b.internal_id && d.status !== 'Invalid');
    if (dup) return c.json({ ...view(dup), idempotent_replay: true }, 200);
  }
  const cfg = await r.config(tenantId);
  const customers = await r.list<Customer>(tenantId, 'customers');
  const items = await r.list<Item>(tenantId, 'items');
  let counterparty: Doc['counterparty']; let customerId: string | undefined;
  if (typeof b.customer === 'string') {
    const cu = customers.find((x) => x.id === b.customer || x.taxId === b.customer);
    if (!cu) throw new HttpError(422, 'unknown_customer', `Customer ${b.customer} not found. Create it with POST /customers or send it inline.`);
    counterparty = { type: cu.type, id: cu.taxId, name: cu.name, address: cu.address }; customerId = cu.id;
  } else counterparty = b.customer as Doc['counterparty'];
  const lines: DocLine[] = b.lines.map((l, i) => {
    const it = l.item ? items.find((x) => x.id === l.item || x.internalCode === l.item || x.itemCode === l.item) : undefined;
    if (l.item && !it) throw new HttpError(422, 'unknown_item', `lines[${i}].item ${l.item} not found.`);
    const description = l.description ?? it?.name;
    const itemCode = l.item_code ?? it?.itemCode;
    if (!description || !itemCode) throw new HttpError(422, 'incomplete_line', `lines[${i}] needs an item or description + item_code.`);
    return {
      itemId: it?.id, description, itemType: l.item_type ?? it?.itemType ?? 'EGS', itemCode, internalCode: it?.internalCode, unitType: l.unit_type ?? it?.unitType ?? 'EA',
      quantity: l.quantity, unitPrice: l.unit_price ?? it?.price ?? 0, currency: l.currency ?? it?.currency ?? 'EGP', exchangeRate: l.exchange_rate,
      discountRate: l.discount_rate ?? 0, taxes: l.taxes ?? it?.taxes ?? [{ taxType: 'T1', subType: 'V009', rate: 14 }],
    };
  });
  const pp = b.payment_plan;
  const plan: Doc['plan'] = !pp ? { kind: 'one-time', terms: (cfg.settings.defaultTerms as 'net30') } : pp.kind === 'installments' && 'down_payment_pct' in pp
    ? { kind: 'installments', count: pp.count, frequency: pp.frequency ?? 'monthly', firstDueDate: new Date().toISOString().slice(0, 10), downPaymentPct: pp.down_payment_pct ?? 0 }
    : (pp as Doc['plan']);
  const draft: Doc = {
    id: newId('d'), direction: 'sent', documentType: b.type, internalID: b.internal_id ?? '', status: 'Draft', counterparty, customerId,
    branchId: cfg.company.branches.find((x) => x.code === b.branch || x.id === b.branch)?.id ?? cfg.company.branches[0].id, activityCode: cfg.company.activityCode,
    issuedAt: b.issued_at ?? new Date().toISOString(), lines, extraDiscount: 0, references: b.references, poRef: b.po_ref, notes: b.notes, plan, payments: [], events: [],
  };
  let doc = await saveDraft(db, tenantId, draft, `API · ${c.get('keyName')}`);
  if (b.submit) { await submitDocuments(db, tenantId, [doc.id], `API · ${c.get('keyName')}`); doc = (await r.doc(tenantId, doc.id))!; }
  return c.json(view(doc), 201);
});

ext.post('/documents/:id/submit', async (c) => {
  const db = await getDb();
  await submitDocuments(db, c.get('tenantId'), [c.req.param('id')], `API · ${c.get('keyName')}`);
  return c.json(view((await repo(db).doc(c.get('tenantId'), c.req.param('id')))!));
});
ext.post('/documents/:id/cancel', async (c) => {
  const { reason } = S.reason.parse(await c.req.json().catch(() => ({})));
  return c.json(view(await changeState(await getDb(), c.get('tenantId'), c.req.param('id'), 'cancel', reason, `API · ${c.get('keyName')}`)));
});

ext.get('/customers', async (c) => c.json({ data: await repo(await getDb()).list(c.get('tenantId'), 'customers') }));
ext.post('/customers', async (c: Context) => {
  const b = await c.req.json().catch(() => ({}));
  const cu = S.customer.parse({ id: b.id ?? newId('c'), createdAt: new Date().toISOString(), terms: 'net30', currency: 'EGP', email: '', ...b });
  await repo(await getDb()).put(c.get('tenantId'), 'customers', cu.id, cu);
  return c.json(cu, 201);
});
ext.get('/items', async (c) => c.json({ data: await repo(await getDb()).list(c.get('tenantId'), 'items') }));
