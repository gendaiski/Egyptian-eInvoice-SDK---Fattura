import { beforeAll, describe, expect, it } from 'vitest';
import { DEMO_USERS } from '../src/db/seed';
import { signCades, softwareSigner } from '../src/signing/cades';
import { generateTestCertificate } from '../src/signing/testCert';
import { client, freshApp } from './helpers';

let app: Awaited<ReturnType<typeof freshApp>>;
beforeAll(async () => { app = await freshApp(); });

const draft = (over: Record<string, unknown> = {}) => ({
  id: 'd_test_' + Math.random().toString(36).slice(2, 8), documentType: 'I', internalID: '', counterparty: { type: 'B', id: '204918337', name: 'Nile Delta Logistics S.A.E.', address: { country: 'EG', governate: 'Cairo', regionCity: 'New Cairo', street: '90th Street North', buildingNumber: '47' } },
  customerId: 'c1', branchId: 'b0', activityCode: '6201', issuedAt: new Date().toISOString(), extraDiscount: 0, plan: { kind: 'one-time', terms: 'net30' },
  lines: [{ description: 'ERP implementation — day rate', itemType: 'EGS', itemCode: 'EG-100483726-IMPL01', unitType: 'DAY', quantity: 5, unitPrice: 9500, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }, { taxType: 'T4', subType: 'W004', rate: 3 }] }],
  ...over,
});

describe('public & auth', () => {
  it('serves health, public bootstrap and rejects bad logins', async () => {
    const c = client(app);
    expect((await c.get('/health')).json.ok).toBe(true);
    const boot = await c.get('/v1/bootstrap');
    expect(boot.json.session.signedIn).toBe(false);
    expect(boot.json.admin.plans.length).toBeGreaterThan(0);
    expect(boot.json.docs).toEqual([]);
    expect((await c.login(DEMO_USERS.owner.email, 'wrong')).status).toBe(401);
  });

  it('signs up a new company with the chosen plan and billing model', async () => {
    const c = client(app);
    const res = await c.post('/v1/auth/signup', { name: 'Hana Ali', company: 'Hana Trading', email: 'hana@example.com', password: 'longpassword1', plan: 'scale', billing: 'installments' });
    expect(res.status).toBe(201);
    const boot = await c.get('/v1/bootstrap');
    expect(boot.json.session.onboarded).toBe(false);
    expect(boot.json.admin.tenants[0]).toMatchObject({ planId: 'scale', model: 'installments', status: 'trial' });
    expect((await c.post('/v1/auth/signup', { name: 'X Y', company: 'X', email: 'hana@example.com', password: 'longpassword1' })).status).toBe(409);
  });

  it('accepts website contact requests into the staff leads inbox', async () => {
    const anon = client(app);
    expect((await anon.post('/v1/public/contact', { name: 'Omar', email: 'omar@example.com', company: 'Omar Co', topic: 'demo', message: 'Please show us bulk submit.' })).status).toBe(201);
    const staff = client(app); await staff.login(DEMO_USERS.staff.email, DEMO_USERS.staff.password);
    const boot = await staff.get('/v1/bootstrap');
    expect(boot.json.admin.leads.some((l: { email: string }) => l.email === 'omar@example.com')).toBe(true);
  });
});

describe('document pipeline on the ETA simulator', () => {
  it('saves a draft, numbers it, signs with the test certificate and validates', async () => {
    const c = client(app); await c.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const d = draft({ plan: { kind: 'installments', count: 3, frequency: 'monthly', firstDueDate: new Date().toISOString().slice(0, 10), downPaymentPct: 20 } });
    const saved = await c.put(`/v1/data/docs/${d.id}`, d);
    expect(saved.status).toBe(200);
    expect(saved.json.internalID).toMatch(/^INV-\d{4}-\d{5}$/);
    expect(saved.json.installments).toHaveLength(4);
    const sub = await c.post('/v1/actions/documents/submit', { ids: [d.id] });
    expect(sub.status).toBe(200);
    expect(sub.json.accepted).toBe(1);
    const boot = await c.get('/v1/bootstrap');
    const doc = boot.json.docs.find((x: { id: string }) => x.id === d.id);
    expect(doc.status).toBe('Valid');
    expect(doc.uuid).toBeTruthy();
    expect(doc.steps.every((s: { status: string }) => s.status === 'Valid')).toBe(true);
    // payments apply to installments in order
    const pay = await c.post(`/v1/actions/documents/${d.id}/payments`, { date: new Date().toISOString().slice(0, 10), amount: doc.installments[0].amount, method: 'bank' });
    expect(pay.json.installments[0].paid).toBe(doc.installments[0].amount);
    // cancel within the window
    const cancel = await c.post(`/v1/actions/documents/${d.id}/cancel`, { reason: 'Wrong quantity on line 1' });
    expect(cancel.json.status).toBe('Cancelled');
  });

  it('returns Invalid from the Code validator for an unapproved item code', async () => {
    const c = client(app); await c.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const d = draft({ lines: [{ description: 'POS integration package', itemType: 'EGS', itemCode: 'EG-100483726-POS01', unitType: 'EA', quantity: 1, unitPrice: 27000, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }] }] });
    await c.put(`/v1/data/docs/${d.id}`, d);
    await c.post('/v1/actions/documents/submit', { ids: [d.id] });
    const doc = (await c.get('/v1/bootstrap')).json.docs.find((x: { id: string }) => x.id === d.id);
    expect(doc.status).toBe('Invalid');
    expect(doc.steps.find((s: { name: string }) => s.name === 'Code validator').error.code).toBe('ItemCodeNotActive');
  });

  it('blocks submission when pre-flight fails and refuses edits after submission', async () => {
    const c = client(app); await c.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const bad = draft({ counterparty: { type: 'B', id: '123', name: 'Bad RIN Co', address: { country: 'EG', governate: 'Cairo', regionCity: 'x', street: 'y', buildingNumber: '1' } } });
    await c.put(`/v1/data/docs/${bad.id}`, bad);
    const res = await c.post('/v1/actions/documents/submit', { ids: [bad.id] });
    expect(res.status).toBe(422);
    expect(res.json.error.code).toBe('preflight_failed');
    const valid = (await c.get('/v1/bootstrap')).json.docs.find((x: { status: string; direction: string }) => x.status === 'Valid' && x.direction === 'sent');
    expect((await c.put(`/v1/data/docs/${valid.id}`, { ...valid, notes: 'edit' })).status).toBe(409);
  });

  it('enforces roles: viewers cannot write, staff cannot touch workspaces', async () => {
    const staff = client(app); await staff.login(DEMO_USERS.staff.email, DEMO_USERS.staff.password);
    expect((await staff.put('/v1/data/docs/x', draft({ id: 'x' }))).status).toBe(403);
    const owner = client(app); await owner.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    expect((await owner.put('/v1/data/admin.plans/growth', { id: 'growth', monthly: 1 })).status).toBe(403);
  });

  it('runs a recurring schedule now and issues a dated draft', async () => {
    const c = client(app); await c.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const res = await c.post('/v1/actions/recurring/r3/run');
    expect(res.status).toBe(200);
    expect(res.json.recurringId).toBe('r3');
    expect(res.json.issuedAt.slice(0, 10)).toBe(new Date().toISOString().slice(0, 10));
  });
});

describe('USB-token signer agent protocol', () => {
  it('queues a job, lets the agent sign it, then submits and validates', async () => {
    const owner = client(app); await owner.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const pair = await owner.post('/v1/actions/signing/agents', { name: 'FIN-PC-02' });
    expect(pair.status).toBe(201);
    await owner.put('/v1/data/singleton/signing', { method: 'usb-token' });
    const agentH = { Authorization: `Agent ${pair.json.token}` };
    const tc = generateTestCertificate('Lawtech Labs Egypt LLC', '100483726');
    await owner.post('/v1/signer/heartbeat', { version: '2.5.0', host: 'FIN-PC-02', certificate: { subject: 'CN=Lawtech', issuer: 'Egypt Trust', serial: '01', expires: '2027-01-01' } }, agentH);
    expect((await owner.get('/v1/bootstrap')).json.signing.agent.status).toBe('online');

    const d = draft();
    await owner.put(`/v1/data/docs/${d.id}`, d);
    const sub = await owner.post('/v1/actions/documents/submit', { ids: [d.id] });
    expect(sub.json.queued).toBe(true);
    const jobs = await owner.get('/v1/signer/jobs?wait=0', agentH);
    expect(jobs.json.jobs).toHaveLength(1);
    const job = jobs.json.jobs[0];
    const signer = await softwareSigner(tc.keyPem, tc.certPem);
    const signatures = await Promise.all(job.items.map(async (it: { docId: string; canonical: string }) => ({ docId: it.docId, value: await signCades(it.canonical, signer) })));
    const done = await owner.post(`/v1/signer/jobs/${job.id}`, { signatures }, agentH);
    expect(done.status).toBe(200);
    const doc = (await owner.get('/v1/bootstrap')).json.docs.find((x: { id: string }) => x.id === d.id);
    expect(doc.status).toBe('Valid');
    await owner.put('/v1/data/singleton/signing', { method: 'test-certificate' });
  });

  it('rejects a signature that does not match the document', async () => {
    const owner = client(app); await owner.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const pair = await owner.post('/v1/actions/signing/agents', { name: 'tamper' });
    await owner.put('/v1/data/singleton/signing', { method: 'usb-token' });
    const d = draft(); await owner.put(`/v1/data/docs/${d.id}`, d);
    await owner.post('/v1/actions/documents/submit', { ids: [d.id] });
    const h = { Authorization: `Agent ${pair.json.token}` };
    const job = (await owner.get('/v1/signer/jobs?wait=0', h)).json.jobs[0];
    const tc = generateTestCertificate('X', '100483726');
    const wrong = await signCades('something else', await softwareSigner(tc.keyPem, tc.certPem));
    const res = await owner.post(`/v1/signer/jobs/${job.id}`, { signatures: [{ docId: d.id, value: wrong }] }, h);
    expect(res.status).toBe(422);
    await owner.put('/v1/data/singleton/signing', { method: 'test-certificate' });
  });
});

describe('integration API (API keys)', () => {
  it('creates and submits a document idempotently by internal_id', async () => {
    const owner = client(app); await owner.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const key = (await owner.post('/v1/actions/api-keys', { name: 'SAP B1' })).json.key;
    const erp = client(app);
    const h = { Authorization: `Bearer ${key}` };
    expect((await erp.get('/v1/ext/documents')).status).toBe(401);
    const body = { internal_id: 'SAP-90001', customer: '204918337', lines: [{ item: 'IMPL01', quantity: 2 }], submit: true };
    const a = await erp.post('/v1/ext/documents', body, h);
    expect(a.status).toBe(201);
    expect(a.json.status).toBe('Valid');
    expect(a.json.public_url).toContain('invoicing.eta.gov.eg/documents/');
    const b = await erp.post('/v1/ext/documents', body, h);
    expect(b.status).toBe(200);
    expect(b.json.idempotent_replay).toBe(true);
    expect((await erp.get('/v1/ext/documents/SAP-90001', h)).json.id).toBe(a.json.id);
  });
});

describe('received documents between two tenants', () => {
  it('routes an invoice issued to another Fatura tenant into its inbox, where it can be rejected', async () => {
    // Tenant B signs up and is onboarded with the RIN that tenant A invoices.
    const b = client(app);
    await b.post('/v1/auth/signup', { name: 'Buyer Admin', company: 'Buyer Co', email: 'buyer@example.com', password: 'longpassword1' });
    const boot = (await b.get('/v1/bootstrap')).json;
    await b.put('/v1/data/singleton/company', { ...boot.company, rin: '311204587', branches: [{ ...boot.company.branches[0], address: { country: 'EG', governate: 'Alexandria', regionCity: 'Smouha', street: 'Fawzy Moaz', buildingNumber: '12' } }] });
    await b.post('/v1/actions/signing/test-certificate');
    // Tenant A invoices that RIN.
    const a = client(app); await a.login(DEMO_USERS.owner.email, DEMO_USERS.owner.password);
    const d = draft({ counterparty: { type: 'B', id: '311204587', name: 'Buyer Co', address: { country: 'EG', governate: 'Alexandria', regionCity: 'Smouha', street: 'Fawzy Moaz', buildingNumber: '12' } }, customerId: undefined });
    await a.put(`/v1/data/docs/${d.id}`, d);
    await a.post('/v1/actions/documents/submit', { ids: [d.id] });
    const issued = (await a.get('/v1/bootstrap')).json.docs.find((x: { id: string }) => x.id === d.id);
    const sync = await b.post('/v1/actions/received/sync');
    expect(sync.json.imported).toBeGreaterThanOrEqual(1);
    const received = (await b.get('/v1/bootstrap')).json.docs.find((x: { uuid: string }) => x.uuid === issued.uuid);
    expect(received.direction).toBe('received');
    expect(received.lines[0].itemCode).toBe('EG-100483726-IMPL01');
    expect(received.counterparty.name).toContain('Lawtech');
    const rej = await b.post(`/v1/actions/documents/${received.id}/reject`, { reason: 'Goods not received' });
    expect(rej.json.status).toBe('Rejected');
  });
});
