import { Hono, type Context } from 'hono';
import type { ZodType } from 'zod';
import type { Doc, Lead } from '../../../src/store/model';
import { clearSession, issueSession, requireStaff, requireTenant, requireUser } from '../auth/session';
import { getDb } from '../db/client';
import { encrypt, hashPassword, newId, verifyPassword } from '../crypto';
import { HttpError } from '../http';
import { repo } from '../repo';
import { saveDraft, requestCodes } from '../services/documents';
import { buildBootstrap } from './bootstrap';
import { S } from './validators';

export const core = new Hono();

const ip = (c: Context) => c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? c.req.header('x-real-ip') ?? '';
const parse = <T,>(schema: ZodType<T>, v: unknown): T => {
  const r = schema.safeParse(v);
  if (!r.success) throw new HttpError(422, 'invalid_body', r.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), r.error.issues);
  return r.data;
};
const body = async (c: Context) => { try { return await c.req.json(); } catch { throw new HttpError(400, 'invalid_json', 'Request body must be JSON.'); } };

/* ---------------- Bootstrap ---------------- */
core.get('/bootstrap', async (c) => c.json(await buildBootstrap(await getDb(), c.get('user'))));

/* ---------------- Auth ---------------- */
const attempts = new Map<string, { n: number; at: number }>();
function throttle(key: string) {
  const a = attempts.get(key);
  if (a && Date.now() - a.at < 15 * 60_000 && a.n >= 10) throw new HttpError(429, 'too_many_attempts', 'Too many attempts. Try again in 15 minutes.');
  attempts.set(key, a && Date.now() - a.at < 15 * 60_000 ? { n: a.n + 1, at: a.at } : { n: 1, at: Date.now() });
}

core.post('/auth/login', async (c) => {
  const { email, password } = parse(S.login, await body(c));
  throttle(`login:${email.toLowerCase()}:${ip(c)}`);
  const db = await getDb();
  const [u] = await db.query<{ id: string; password_hash: string; staff_role: string | null }>('SELECT id, password_hash, staff_role FROM users WHERE lower(email) = lower($1)', [email]);
  if (!u || !(await verifyPassword(password, u.password_hash))) throw new HttpError(401, 'bad_credentials', 'Email or password is incorrect.');
  const [m] = await db.query<{ tenant_id: string }>("SELECT tenant_id FROM memberships WHERE user_id = $1 AND status = 'active' ORDER BY role = 'Owner' DESC LIMIT 1", [u.id]);
  await db.query('UPDATE users SET last_active = now() WHERE id = $1', [u.id]);
  await issueSession(c, u.id, m?.tenant_id ?? null);
  await repo(db).audit(email, 'user.signin', email, m?.tenant_id, ip(c));
  return c.json({ ok: true });
});

core.post('/auth/logout', (c) => { clearSession(c); return c.json({ ok: true }); });

core.post('/auth/signup', async (c) => {
  const b = parse(S.signup, await body(c));
  throttle(`signup:${ip(c)}`);
  const db = await getDb();
  const r = repo(db);
  const plans = await r.platform<{ id: string; featured?: boolean }>('plans');
  const plan = plans.find((p) => p.id === b.plan) ?? plans.find((p) => p.featured) ?? plans[0];
  const billing = b.billing ?? 'monthly';
  const userId = newId('u'), tenantId = newId('t');
  await db.tx(async (tx) => {
    const exists = await tx.query('SELECT 1 FROM users WHERE lower(email) = lower($1)', [b.email]);
    if (exists.length) throw new HttpError(409, 'email_taken', 'An account with this email already exists. Sign in instead.');
    await tx.query('INSERT INTO users (id, email, name, password_hash, last_active) VALUES ($1,$2,$3,$4, now())', [userId, b.email, b.name, await hashPassword(b.password)]);
    const tenant = { id: tenantId, name: b.company, rin: '—', owner: b.email, governorate: 'Cairo', planId: plan.id, model: billing === 'monthly' || billing === 'yearly' ? 'recurring' : billing, cycle: billing === 'monthly' || billing === 'yearly' ? billing : undefined, status: 'trial', env: 'preprod', docsThisMonth: 0, invalidRate: 0, signer: 'offline', mrr: 0, createdAt: new Date().toISOString(), installmentsPaid: billing === 'installments' ? 0 : undefined };
    await tx.query('INSERT INTO tenants (id, name, status, plan_id, data) VALUES ($1,$2,$3,$4,$5)', [tenantId, b.company, 'trial', plan.id, JSON.stringify(tenant)]);
    await tx.query('INSERT INTO memberships (user_id, tenant_id, role) VALUES ($1,$2,$3)', [userId, tenantId, 'Owner']);
    await tx.query('INSERT INTO tenant_config (tenant_id, company, integration, signing, settings, onboarded) VALUES ($1,$2,$3,$4,$5,false)', [
      tenantId,
      JSON.stringify({ name: b.company, nameAr: b.company, rin: '', activityCode: '6201', email: b.email, phone: '', iban: '', bankName: '', branches: [{ id: 'b0', code: '0', name: 'Head office', nameAr: 'المقر الرئيسي', address: { country: 'EG', governate: 'Cairo', regionCity: '', street: '', buildingNumber: '' } }] }),
      JSON.stringify({ env: 'simulator', clientId: 'simulator', secretSet: true, status: 'connected' }),
      JSON.stringify({ method: 'test-certificate', agent: { status: 'offline', version: '', host: '', lastSeen: '' }, certificate: { subject: '', issuer: '', serial: '', expires: '' } }),
      JSON.stringify({ numbering: { I: { pattern: 'INV-{YYYY}-{#####}', next: 1 }, C: { pattern: 'CN-{YYYY}-{#####}', next: 1 }, D: { pattern: 'DN-{YYYY}-{#####}', next: 1 }, EI: { pattern: 'EXP-{YYYY}-{#####}', next: 1 } }, personIdThreshold: 50000, defaultTerms: 'net30', autoEmail: true }),
    ]);
    await tx.query('UPDATE tenant_config SET eta_client_secret_enc = $2 WHERE tenant_id = $1', [tenantId, encrypt('simulator')]);
    const lead: Lead = { id: newId('l'), at: new Date().toISOString(), name: b.name, email: b.email, company: b.company, topic: 'sales', message: `Started a trial on ${plan.id} (${billing}).`, source: 'signup', planId: plan.id, billing, status: 'new' };
    await repo(tx).putPlatform('leads', lead.id, lead);
  });
  await issueSession(c, userId, tenantId);
  await r.audit(b.email, 'tenant.signup', b.company, tenantId, ip(c));
  return c.json({ ok: true, tenantId }, 201);
});

/* ---------------- Public website ---------------- */
core.post('/public/contact', async (c) => {
  const b = parse(S.lead, await body(c));
  throttle(`contact:${ip(c)}`);
  const db = await getDb();
  const lead: Lead = { ...b, id: newId('l'), at: new Date().toISOString(), source: b.planId ? 'pricing' : 'contact', status: 'new' } as Lead;
  await repo(db).putPlatform('leads', lead.id, lead);
  return c.json({ ok: true, id: lead.id }, 201);
});

/* ---------------- Data sync: per-collection upsert/delete with role and invariant checks ---------------- */
core.put('/data/singleton/:name', async (c) => {
  const name = c.req.param('name');
  const db = await getDb();
  const r = repo(db);
  const b = await body(c);
  if (name === 'admin.site') {
    const u = requireStaff(c, ['Super admin']);
    if (!b?.banner || typeof b.banner.on !== 'boolean') throw new HttpError(422, 'invalid_body', 'banner is required.');
    await r.putPlatform('site', 'main', { banner: { on: b.banner.on, tone: b.banner.tone === 'warn' ? 'warn' : 'info', text: { en: String(b.banner.text?.en ?? ''), ar: String(b.banner.text?.ar ?? '') }, link: b.banner.link ? String(b.banner.link) : undefined } });
    await r.audit(u.email, 'site.banner.update', 'website');
    return c.json({ ok: true });
  }
  const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
  const cfg = await r.config(u.tenantId);
  if (name === 'company') {
    const company = parse(S.company, b);
    if (cfg.company.rin && cfg.company.rin !== company.rin && cfg.integration.env !== 'simulator' && cfg.secretEnc) throw new HttpError(409, 'rin_locked', 'The tax registration number is locked while connected to ETA.');
    await r.saveConfig(u.tenantId, { company });
    await db.query('UPDATE tenants SET name = $2, data = jsonb_set(data, \'{rin}\', to_jsonb($3::text)) WHERE id = $1', [u.tenantId, company.name, company.rin]);
  } else if (name === 'integration') {
    const i = parse(S.integration, b);
    const changed = i.env !== cfg.integration.env || i.clientId !== cfg.integration.clientId;
    await r.saveConfig(u.tenantId, { integration: { ...cfg.integration, env: i.env, clientId: i.clientId, status: changed ? (i.env === 'simulator' ? 'connected' : 'not_configured') : cfg.integration.status } });
    if (changed) await r.audit(u.email, 'integration.update', i.env, u.tenantId, ip(c));
  } else if (name === 'signing') {
    const s = parse(S.signing, b);
    await r.saveConfig(u.tenantId, { signing: { ...cfg.signing, method: s.method } });
  } else if (name === 'settings') {
    const s = parse(S.settings, b);
    await r.saveConfig(u.tenantId, { settings: { ...cfg.settings, numbering: s.numbering, defaultTerms: s.defaultTerms, autoEmail: s.autoEmail } });
  } else throw new HttpError(404, 'unknown_singleton', `Unknown setting ${name}.`);
  return c.json({ ok: true });
});

const TENANT_COLLECTIONS = { customers: S.customer, items: S.item, recurring: S.recurring } as const;

core.put('/data/:collection/:id', async (c) => {
  const { collection, id } = c.req.param();
  const db = await getDb();
  const r = repo(db);
  const b = await body(c);
  if (b?.id !== undefined && b.id !== id) throw new HttpError(422, 'id_mismatch', 'Body id must match the URL.');

  if (collection in TENANT_COLLECTIONS) {
    const u = requireTenant(c, { write: true });
    const data = parse(TENANT_COLLECTIONS[collection as keyof typeof TENANT_COLLECTIONS] as ZodType<Record<string, unknown>>, b);
    if (collection === 'items') {
      const existing = await r.get<{ codeStatus: string; codeRequestedAt: string }>(u.tenantId, 'items', id);
      data.codeStatus = existing?.codeStatus ?? (data.itemType === 'GS1' ? 'Approved' : 'Submitted');
      data.codeRequestedAt = existing?.codeRequestedAt ?? new Date().toISOString();
      await r.put(u.tenantId, 'items', id, data);
      if (!existing && data.itemType === 'EGS') await requestCodes(db, u.tenantId, [id]).catch(() => undefined);
    } else await r.put(u.tenantId, collection as 'customers' | 'recurring', id, data);
    return c.json(await r.get(u.tenantId, collection as 'customers', id));
  }
  if (collection === 'docs') {
    const u = requireTenant(c, { roles: ['Owner', 'Admin', 'Accountant', 'Sales'] });
    const doc = parse(S.doc, b) as unknown as Doc;
    return c.json(await saveDraft(db, u.tenantId, doc, u.name));
  }
  if (collection === 'notices') {
    const u = requireTenant(c);
    const n = await r.get<{ read: boolean }>(u.tenantId, 'notices', id);
    if (!n) throw new HttpError(404, 'not_found', 'Notification not found.');
    await r.put(u.tenantId, 'notices', id, { ...n, read: !!b.read });
    return c.json({ ok: true });
  }
  if (collection === 'members') {
    const u = requireTenant(c, { roles: ['Owner', 'Admin'] });
    const role = String(b.role);
    if (!['Admin', 'Accountant', 'Sales', 'Viewer'].includes(role)) throw new HttpError(422, 'bad_role', 'Unknown role.');
    const [existing] = await db.query('SELECT 1 FROM memberships WHERE user_id = $1 AND tenant_id = $2', [id, u.tenantId]);
    if (existing) await db.query("UPDATE memberships SET role = $3 WHERE user_id = $1 AND tenant_id = $2 AND role <> 'Owner'", [id, u.tenantId, role]);
    else {
      const email = String(b.email ?? '').toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new HttpError(422, 'bad_email', 'Enter a valid email.');
      await db.query("INSERT INTO users (id, email, name, password_hash) VALUES ($1,$2,$3,'disabled$') ON CONFLICT (email) DO NOTHING", [id, email, String(b.name ?? email.split('@')[0])]);
      const [usr] = await db.query<{ id: string }>('SELECT id FROM users WHERE lower(email) = $1', [email]);
      await db.query("INSERT INTO memberships (user_id, tenant_id, role, status) VALUES ($1,$2,$3,'invited') ON CONFLICT DO NOTHING", [usr.id, u.tenantId, role]);
      await r.audit(u.email, 'member.invite', email, u.tenantId, ip(c));
    }
    return c.json({ ok: true });
  }
  if (collection.startsWith('admin.')) return adminUpsert(c, collection.slice(6), id, b);
  throw new HttpError(404, 'unknown_collection', `Unknown collection ${collection}.`);
});

core.delete('/data/:collection/:id', async (c) => {
  const { collection, id } = c.req.param();
  const db = await getDb();
  const r = repo(db);
  const u = requireTenant(c, { write: true });
  if (collection === 'docs') { await r.deleteDoc(u.tenantId, id); return c.json({ ok: true }); }
  if (collection === 'customers' || collection === 'items' || collection === 'recurring') { await r.remove(u.tenantId, collection, id); return c.json({ ok: true }); }
  if (collection === 'members') { requireTenant(c, { roles: ['Owner', 'Admin'] }); await db.query("DELETE FROM memberships WHERE user_id = $1 AND tenant_id = $2 AND role <> 'Owner'", [id, u.tenantId]); return c.json({ ok: true }); }
  throw new HttpError(405, 'not_deletable', `${collection} records cannot be deleted.`);
});

async function adminUpsert(c: Context, kind: string, id: string, b: Record<string, unknown>) {
  const db = await getDb();
  const r = repo(db);
  if (kind === 'leads') {
    const existing = await r.platformOne<Lead>('leads', id);
    const user = c.get('user');
    if (!existing) {
      // Anonymous website visitors create leads through the same path as the contact form.
      const lead = parse(S.lead, b);
      await r.putPlatform('leads', id, { ...lead, id, at: new Date().toISOString(), source: b.source === 'pricing' ? 'pricing' : 'contact', status: 'new' });
      return c.json({ ok: true }, 201);
    }
    if (!user?.staffRole) throw new HttpError(403, 'forbidden', 'Fatura staff only.');
    const status = String(b.status);
    if (!['new', 'contacted', 'qualified', 'won', 'lost'].includes(status)) throw new HttpError(422, 'bad_status', 'Unknown lead status.');
    await r.putPlatform('leads', id, { ...existing, status });
    return c.json({ ok: true });
  }
  const u = requireStaff(c);
  if (kind === 'plans') {
    requireStaff(c, ['Super admin', 'Finance']);
    for (const k of ['monthly', 'yearly', 'oneTime', 'docsPerMonth', 'users', 'branches']) if (typeof b[k] !== 'number' || (b[k] as number) < 0) throw new HttpError(422, 'invalid_plan', `${k} must be a non-negative number.`);
    await r.putPlatform('plans', id, { ...b, id });
    await r.audit(u.email, 'plan.update', String(b.name ?? id));
  } else if (kind === 'tenants') {
    requireStaff(c, ['Super admin', 'Support']);
    const [t] = await db.query<{ data: Record<string, unknown> }>('SELECT data FROM tenants WHERE id = $1', [id]);
    if (!t) throw new HttpError(404, 'not_found', 'Tenant not found.');
    const status = String(b.status ?? t.data.status), planId = String(b.planId ?? t.data.planId);
    if (!['active', 'trial', 'past_due', 'suspended'].includes(status)) throw new HttpError(422, 'bad_status', 'Unknown tenant status.');
    const data = { ...t.data, status, planId, model: b.model ?? t.data.model, cycle: b.cycle ?? t.data.cycle };
    await db.query('UPDATE tenants SET status = $2, plan_id = $3, data = $4 WHERE id = $1', [id, status, planId, JSON.stringify(data)]);
    await r.audit(u.email, status !== t.data.status ? `tenant.${status}` : 'plan.change', String(t.data.name), id);
  } else if (kind === 'invoices') {
    requireStaff(c, ['Super admin', 'Finance']);
    const inv = await r.platformOne<Record<string, unknown>>('invoices', id);
    if (!inv) throw new HttpError(404, 'not_found', 'Invoice not found.');
    await r.putPlatform('invoices', id, { ...inv, status: b.status });
    if (b.status === 'paid') await db.query("UPDATE tenants SET status = 'active', data = jsonb_set(data, '{status}', '\"active\"') WHERE id = $1 AND status = 'past_due'", [inv.tenantId]);
    await r.audit(u.email, 'billing.payment_received', String(inv.number));
  } else if (kind === 'refs') {
    requireStaff(c, ['Super admin', 'Support']);
    const ref = await r.platformOne<Record<string, unknown>>('refs', id);
    if (!ref) throw new HttpError(404, 'not_found', 'Reference table not found.');
    await r.putPlatform('refs', id, { ...ref, syncedAt: new Date().toISOString(), status: 'ok' });
  } else throw new HttpError(404, 'unknown_collection', `Unknown admin collection ${kind}.`);
  return c.json({ ok: true });
}

/* ---------------- Me ---------------- */
core.get('/me', (c) => { const u = requireUser(c); return c.json(u); });
