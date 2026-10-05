import type { Db } from '../db/client';
import type { SessionUser } from '../auth/session';
import { repo, type ServerSigning } from '../repo';
import type { Tenant } from '../../../src/store/model';

const emptyCompany = { name: '', nameAr: '', rin: '', activityCode: '', email: '', phone: '', branches: [{ id: 'b0', code: '0', name: 'Head office', nameAr: 'المقر الرئيسي', address: { country: 'EG', governate: 'Cairo', regionCity: '', street: '', buildingNumber: '' } }], iban: '', bankName: '' };

/** Public view of the signing config: agent status is derived from the paired agents' heartbeats. */
async function signingView(db: Db, tenantId: string, s: ServerSigning) {
  const { certificatePem: _pem, ...rest } = s;
  if (s.method === 'test-certificate') return { ...rest, agent: { status: 'online', version: 'server', host: 'Fatura server (test certificate)', lastSeen: new Date().toISOString() } };
  const [a] = await db.query<{ last_seen: string | null; version: string | null; host: string | null }>('SELECT last_seen, version, host FROM agents WHERE tenant_id = $1 AND NOT revoked ORDER BY last_seen DESC NULLS LAST LIMIT 1', [tenantId]);
  const online = !!a?.last_seen && Date.now() - new Date(a.last_seen).getTime() < 120_000;
  return { ...rest, agent: { status: online ? 'online' : 'offline', version: a?.version ?? '', host: a?.host ?? 'No signer paired', lastSeen: a?.last_seen ?? '' } };
}

/**
 * The whole client state in the shape of the front-end `DB` type (src/store/model.ts).
 * Tenant data only for members of that tenant; platform data only for staff; public data for everyone.
 */
export async function buildBootstrap(db: Db, user: SessionUser | null) {
  const r = repo(db);
  const plans = await r.platform('plans');
  const site = (await r.platformOne('site', 'main')) ?? { banner: { on: false, tone: 'info', text: { en: '', ar: '' } } };
  const api = (await r.platform<{ date: string }>('api')).sort((a, b) => a.date.localeCompare(b.date));
  const refs = await r.platform('refs');
  const base = {
    version: 3,
    session: { signedIn: !!user, onboarded: false, user: { name: user?.name ?? '', email: user?.email ?? '' }, tenantId: user?.tenantId ?? undefined, staffRole: user?.staffRole ?? null, role: user?.role ?? null },
    company: emptyCompany,
    integration: { env: 'simulator', clientId: '', secretSet: false, status: 'not_configured' },
    signing: { method: 'test-certificate', agent: { status: 'offline', version: '', host: '', lastSeen: '' }, certificate: { subject: '', issuer: '', serial: '', expires: '' } },
    settings: { numbering: { I: { pattern: 'INV-{YYYY}-{#####}', next: 1 }, C: { pattern: 'CN-{YYYY}-{#####}', next: 1 }, D: { pattern: 'DN-{YYYY}-{#####}', next: 1 }, EI: { pattern: 'EXP-{YYYY}-{#####}', next: 1 } }, personIdThreshold: 50000, defaultTerms: 'net30', autoEmail: true },
    customers: [], items: [], docs: [], recurring: [], submissions: [], receipts: [], members: [], notices: [],
    admin: { plans, tenants: [] as Tenant[], invoices: [] as unknown[], audit: [] as unknown[], users: [] as unknown[], refs, api, leads: [] as unknown[], site },
  };
  if (!user) return base;

  if (user.tenantId) {
    const t = user.tenantId;
    const cfg = await r.config(t);
    const members = await db.query<{ id: string; name: string; email: string; role: string; status: string; last_active: string | null }>('SELECT u.id, u.name, u.email, m.role, m.status, u.last_active FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.tenant_id = $1 ORDER BY m.role', [t]);
    const [tenantRow] = await db.query<{ data: Tenant; status: string; plan_id: string }>('SELECT data, status, plan_id FROM tenants WHERE id = $1', [t]);
    Object.assign(base, {
      session: { ...base.session, onboarded: cfg.onboarded },
      company: cfg.company,
      integration: { ...cfg.integration, secretSet: !!cfg.secretEnc },
      signing: await signingView(db, t, cfg.signing),
      settings: cfg.settings,
      customers: await r.list(t, 'customers'), items: await r.list(t, 'items'), recurring: await r.list(t, 'recurring'),
      submissions: (await r.list<{ at: string }>(t, 'submissions')).sort((a, b) => b.at.localeCompare(a.at)),
      receipts: await r.list(t, 'receipts'), notices: (await r.list<{ at: string }>(t, 'notices')).sort((a, b) => b.at.localeCompare(a.at)),
      docs: await r.docs(t),
      members: members.map((m) => ({ id: m.id, name: m.name, email: m.email, role: m.role, status: m.status, lastActive: m.last_active ?? undefined })),
    });
    if (tenantRow) base.admin.tenants = [{ ...tenantRow.data, status: tenantRow.status as Tenant['status'], planId: tenantRow.plan_id }];
    base.admin.invoices = (await r.platform<{ tenantId: string }>('invoices')).filter((i) => i.tenantId === t);
  }
  if (user.staffRole) {
    const tenants = await db.query<{ data: Tenant; status: string; plan_id: string }>('SELECT data, status, plan_id FROM tenants ORDER BY created_at DESC');
    base.admin.tenants = tenants.map((x) => ({ ...x.data, status: x.status as Tenant['status'], planId: x.plan_id }));
    base.admin.invoices = (await r.platform<{ issuedAt: string }>('invoices')).sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
    base.admin.leads = (await r.platform<{ at: string }>('leads')).sort((a, b) => b.at.localeCompare(a.at));
    base.admin.audit = (await db.query<{ id: string; at: string; actor: string; tenant_id: string | null; action: string; target: string; ip: string | null }>('SELECT * FROM audit ORDER BY at DESC LIMIT 300')).map((a) => ({ id: a.id, at: new Date(a.at).toISOString(), actor: a.actor, tenantId: a.tenant_id ?? undefined, action: a.action, target: a.target, ip: a.ip ?? '' }));
    base.admin.users = (await db.query<{ id: string; name: string; email: string; staff_role: string; mfa: boolean; last_active: string | null }>('SELECT id, name, email, staff_role, mfa, last_active FROM users WHERE staff_role IS NOT NULL ORDER BY name')).map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.staff_role, mfa: u.mfa, lastActive: u.last_active ?? new Date(0).toISOString() }));
    if (!user.tenantId) base.session.onboarded = true;
  }
  return base;
}
