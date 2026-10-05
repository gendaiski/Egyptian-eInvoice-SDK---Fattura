import { seed as frontendSeed } from '../../../src/store/seed';
import { hashPassword, encrypt, newId } from '../crypto';
import { env } from '../env';
import { SimulatorEta } from '../eta/simulator';
import { generateTestCertificate } from '../signing/testCert';
import type { Db } from './client';
import { repo } from '../repo';

export const DEMO_USERS = {
  owner: { email: 'demo@fatura.eg', password: 'fatura-demo-2026', name: 'Yasmine Fouad' },
  staff: { email: 'admin@fatura.eg', password: 'fatura-admin-2026', name: 'Ahmed El Gendy' },
};

/**
 * Seeds an empty database with the same demo company the front end ships with, a staff admin,
 * the platform plans and website data, and matching ETA-simulator state so cancel, reject and
 * inbox flows work on seeded documents. Runs once; a non-empty users table means "already seeded".
 */
export async function seedIfEmpty(db: Db): Promise<boolean> {
  if (env().SEED_DEMO !== 'true') return false;
  const [{ n }] = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM users');
  if (n > 0) return false;
  const s = frontendSeed();
  const r = repo(db);
  const t1 = 't1';
  await db.tx(async (tx) => {
    const tr = repo(tx);
    // Users
    const ownerId = 'u_owner', staffId = 'u_staff';
    await tx.query('INSERT INTO users (id, email, name, password_hash, mfa) VALUES ($1,$2,$3,$4,true)', [ownerId, DEMO_USERS.owner.email, DEMO_USERS.owner.name, await hashPassword(DEMO_USERS.owner.password)]);
    await tx.query('INSERT INTO users (id, email, name, password_hash, staff_role, mfa) VALUES ($1,$2,$3,$4,$5,true)', [staffId, DEMO_USERS.staff.email, DEMO_USERS.staff.name, await hashPassword(DEMO_USERS.staff.password), 'Super admin']);
    for (const u of s.admin.users.slice(1)) await tx.query('INSERT INTO users (id, email, name, password_hash, staff_role, mfa) VALUES ($1,$2,$3,$4,$5,$6)', [u.id, u.email, u.name, 'disabled$', u.role, u.mfa]);

    // Tenants (platform view) — t1 is the full demo workspace
    for (const t of s.admin.tenants) await tx.query('INSERT INTO tenants (id, name, status, plan_id, data, created_at) VALUES ($1,$2,$3,$4,$5,$6)', [t.id, t.name, t.status, t.planId, JSON.stringify(t), t.createdAt]);
    await tx.query('INSERT INTO memberships (user_id, tenant_id, role) VALUES ($1,$2,$3)', [ownerId, t1, 'Owner']);
    for (const m of s.members.filter((m) => m.email !== DEMO_USERS.owner.email && m.role !== 'Owner')) {
      const uid = newId('u');
      await tx.query('INSERT INTO users (id, email, name, password_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO NOTHING', [uid, m.email, m.name, 'disabled$']);
      const [u] = await tx.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [m.email]);
      await tx.query('INSERT INTO memberships (user_id, tenant_id, role, status) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING', [u.id, t1, m.role, m.status]);
    }

    // Demo workspace configuration: simulator + server-side test certificate so everything works out of the box
    const cert = generateTestCertificate(s.company.name, s.company.rin);
    await tx.query('INSERT INTO tenant_config (tenant_id, company, integration, signing, settings, onboarded, eta_client_secret_enc, signing_key_enc) VALUES ($1,$2,$3,$4,$5,true,$6,$7)', [
      t1, JSON.stringify(s.company),
      JSON.stringify({ ...s.integration, env: 'simulator', clientId: 'simulator', secretSet: true, status: 'connected' }),
      JSON.stringify({ method: 'test-certificate', agent: { ...s.signing.agent, status: 'offline' }, certificate: cert.info, certificatePem: cert.certPem }),
      JSON.stringify(s.settings), encrypt('simulator'), encrypt(cert.keyPem),
    ]);
    // Other tenants get a minimal config so staff views work.
    for (const t of s.admin.tenants.filter((x) => x.id !== t1)) {
      await tx.query('INSERT INTO tenant_config (tenant_id, company, integration, signing, settings, onboarded) VALUES ($1,$2,$3,$4,$5,true)', [
        t.id, JSON.stringify({ ...s.company, name: t.name, nameAr: t.name, rin: t.rin, branches: s.company.branches.slice(0, 1) }),
        JSON.stringify({ env: t.env === 'production' ? 'production' : 'preprod', clientId: '', secretSet: false, status: 'not_configured' }),
        JSON.stringify({ method: 'usb-token', agent: { status: t.signer, version: '', host: '', lastSeen: '' }, certificate: { subject: '', issuer: '', serial: '', expires: '' } }),
        JSON.stringify(s.settings),
      ]);
    }

    for (const c of s.customers) await tr.put(t1, 'customers', c.id, c);
    for (const i of s.items) await tr.put(t1, 'items', i.id, i);
    for (const x of s.recurring) await tr.put(t1, 'recurring', x.id, x);
    for (const x of s.submissions) await tr.put(t1, 'submissions', x.id, x);
    for (const x of s.receipts) await tr.put(t1, 'receipts', x.id, x);
    for (const x of s.notices) await tr.put(t1, 'notices', x.id, x);
    for (const d of s.docs) await tr.putDoc(t1, d);

    for (const p of s.admin.plans) await tr.putPlatform('plans', p.id, p);
    for (const i of s.admin.invoices) await tr.putPlatform('invoices', i.id, i);
    for (const l of s.admin.leads) await tr.putPlatform('leads', l.id, l);
    for (const x of s.admin.refs) await tr.putPlatform('refs', x.id, x);
    for (const x of s.admin.api) await tr.putPlatform('api', x.date, x);
    await tr.putPlatform('site', 'main', s.admin.site);
    for (const a of s.admin.audit) await tx.query('INSERT INTO audit (id, at, actor, tenant_id, action, target, ip) VALUES ($1,$2,$3,$4,$5,$6,$7)', [a.id, a.at, a.actor, a.tenantId ?? null, a.action, a.target, a.ip]);

    // ETA simulator state that matches the seeded documents and item codes
    await SimulatorEta.registerApprovedCodes(tx, s.company.rin, s.items.map((i) => ({ itemCode: i.itemCode, status: i.codeStatus, name: i.name })));
    for (const d of s.docs.filter((x) => x.uuid)) {
      const sent = d.direction === 'sent';
      await tr.putPlatform('sim_doc', d.uuid!, {
        uuid: d.uuid, longId: d.longId, internalId: d.internalID, submissionId: d.submissionId ?? newId(), typeName: d.documentType,
        issuerId: sent ? s.company.rin : d.counterparty.id, issuerName: sent ? s.company.name : d.counterparty.name,
        receiverId: sent ? d.counterparty.id : s.company.rin, receiverName: sent ? d.counterparty.name : s.company.name,
        status: d.status === 'Submitted' ? 'Valid' : d.status, steps: d.steps ?? [], submittedAt: d.submittedAt ?? d.issuedAt, validatedAt: d.validatedAt ?? d.issuedAt,
        dateTimeIssued: d.issuedAt, total: 0, cancelRequestDate: d.pending === 'cancellation_requested' ? new Date().toISOString() : null,
      });
    }
  });
  await r.audit('system', 'platform.seeded', 'demo data');
  return true;
}
