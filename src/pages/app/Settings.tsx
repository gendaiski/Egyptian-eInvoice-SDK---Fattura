import {
  Building, CheckCircle2, CreditCard, Database, Download, GitBranch, Hash, KeyRound, Loader2, Plug, Plus, RotateCcw, Server, ShieldCheck, Usb, UserPlus, Users,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import { ENDPOINTS } from '@/eta/client';
import { ACTIVITY_CODES, GOVERNORATES } from '@/eta/codes';
import { DOCUMENT_TYPES, mockEta } from '@/eta/mockClient';
import { bi, useI18n } from '@/i18n';
import { formatNumber, uid, type Branch, type Member } from '@/store/model';
import { useStore } from '@/store/store';
import {
  Avatar, Badge, Button, Callout, Card, DescList, Field, Input, Modal, Money, Mono, PageHeader, Progress, Segmented, Select, Switch, Table, Td, Th, cx, useToast,
} from '@/components/ui';
import { useLabels } from './shared';

export function Settings() {
  const { section = 'company' } = useParams();
  const { L } = useI18n();
  const nav = useNavigate();
  const sections: { id: string; label: string; icon: ReactNode }[] = [
    { id: 'company', label: L('Company profile', 'ملف الشركة'), icon: <Building /> },
    { id: 'branches', label: L('Branches', 'الفروع'), icon: <GitBranch /> },
    { id: 'integration', label: L('ETA connection', 'الربط مع المصلحة'), icon: <Plug /> },
    { id: 'signing', label: L('Signing & certificate', 'التوقيع والشهادة'), icon: <Usb /> },
    { id: 'team', label: L('Team & roles', 'الفريق والأدوار'), icon: <Users /> },
    { id: 'numbering', label: L('Numbering & defaults', 'الترقيم والافتراضيات'), icon: <Hash /> },
    { id: 'billing', label: L('Plan & billing', 'الباقة والفوترة'), icon: <CreditCard /> },
    { id: 'data', label: L('Data & export', 'البيانات والتصدير'), icon: <Database /> },
  ];
  const body: Record<string, ReactNode> = {
    company: <CompanySection />, branches: <BranchesSection />, integration: <IntegrationSection />, signing: <SigningSection />,
    team: <TeamSection />, numbering: <NumberingSection />, billing: <BillingSection />, data: <DataSection />,
  };
  return (
    <div className="animate-in">
      <PageHeader title={L('Settings', 'الإعدادات')} />
      <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)] items-start">
        <nav className="lg:sticky lg:top-[88px]" aria-label={L('Settings sections', 'أقسام الإعدادات')}>
          <select className="input lg:hidden" value={section} onChange={(e) => nav(`/app/settings/${e.target.value}`)} aria-label={L('Section', 'القسم')}>{sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select>
          <ul className="hidden lg:block space-y-0.5">
            {sections.map((s) => (
              <li key={s.id}><NavLink to={`/app/settings/${s.id}`} className={({ isActive }) => cx('flex items-center gap-2.5 h-9 px-2.5 rounded text-[13.5px] font-medium [&>svg]:size-4', isActive ? 'bg-surface border border-line shadow-card text-ink' : 'text-ink-muted hover:text-ink')}>{s.icon}{s.label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-5">{body[section] ?? body.company}</div>
      </div>
    </div>
  );
}

function SaveBar({ onSave }: { onSave(): void }) {
  const { L } = useI18n();
  return <div className="flex justify-end pt-2"><Button variant="primary" onClick={onSave}>{L('Save changes', 'حفظ التغييرات')}</Button></div>;
}

function CompanySection() {
  const { db, set } = useStore();
  const { L, lang } = useI18n();
  const toast = useToast();
  const [c, setC] = useState(db.company);
  return (
    <Card title={L('Company profile', 'ملف الشركة')} subtitle={L('Printed on every document and sent as the ETA issuer.', 'يُطبع على كل مستند ويُرسل كبيانات المُصدر.')}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={L('Legal name (English)', 'الاسم القانوني (إنجليزي)')}>{(id) => <Input id={id} value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} />}</Field>
        <Field label={L('Legal name (Arabic)', 'الاسم القانوني (عربي)')}>{(id) => <Input id={id} dir="rtl" value={c.nameAr} onChange={(e) => setC({ ...c, nameAr: e.target.value })} />}</Field>
        <Field label={L('Tax registration number (RIN)', 'رقم التسجيل الضريبي')} hint={L('Locked while connected to ETA.', 'مقفل أثناء الربط مع المصلحة.')}>{(id) => <Input id={id} dir="ltr" value={c.rin} disabled />}</Field>
        <Field label={L('Main activity code', 'كود النشاط الرئيسي')}>{(id) => <Select id={id} value={c.activityCode} onChange={(e) => setC({ ...c, activityCode: e.target.value })}>{ACTIVITY_CODES.map((a) => <option key={a.code} value={a.code}>{a.code} · {bi(lang, a)}</option>)}</Select>}</Field>
        <Field label={L('Billing email', 'بريد الفواتير')}>{(id) => <Input id={id} dir="ltr" value={c.email} onChange={(e) => setC({ ...c, email: e.target.value })} />}</Field>
        <Field label={L('Phone', 'الهاتف')}>{(id) => <Input id={id} dir="ltr" value={c.phone} onChange={(e) => setC({ ...c, phone: e.target.value })} />}</Field>
        <Field label={L('Bank', 'البنك')}>{(id) => <Input id={id} value={c.bankName} onChange={(e) => setC({ ...c, bankName: e.target.value })} />}</Field>
        <Field label="IBAN">{(id) => <Input id={id} dir="ltr" value={c.iban} onChange={(e) => setC({ ...c, iban: e.target.value.toUpperCase() })} />}</Field>
      </div>
      <SaveBar onSave={() => { set((x) => { x.company = { ...c, branches: x.company.branches }; }); toast({ tone: 'ok', text: L('Company profile saved.', 'تم حفظ ملف الشركة.') }); }} />
    </Card>
  );
}

function BranchesSection() {
  const { db, set } = useStore();
  const { L, lang } = useI18n();
  const [adding, setAdding] = useState<Branch | null>(null);
  return (
    <Card title={L('Branches', 'الفروع')} subtitle={L('The branch code is sent as issuer.address.branchID — 0 is the head office. It must match your ETA registration.', 'كود الفرع يُرسل في عنوان المُصدر — ٠ للمقر الرئيسي.')} pad={false}
      action={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setAdding({ id: uid('b'), code: String(db.company.branches.length), name: '', nameAr: '', address: { country: 'EG', governate: 'Cairo', regionCity: '', street: '', buildingNumber: '' } })}>{L('Add branch', 'إضافة فرع')}</Button>}>
      <Table>
        <thead><tr><Th>{L('Code', 'الكود')}</Th><Th>{L('Branch', 'الفرع')}</Th><Th>{L('Address', 'العنوان')}</Th></tr></thead>
        <tbody>{db.company.branches.map((b) => <tr key={b.id}><Td><Mono>{b.code}</Mono></Td><Td className="font-medium">{bi(lang, { en: b.name, ar: b.nameAr })}</Td><Td className="text-ink-muted">{b.address.buildingNumber} {b.address.street}, {b.address.regionCity}, {b.address.governate}</Td></tr>)}</tbody>
      </Table>
      {adding && (
        <Modal open onClose={() => setAdding(null)} title={L('Add branch', 'إضافة فرع')}
          footer={<><Button onClick={() => setAdding(null)}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" disabled={!adding.name || !adding.address.street} onClick={() => { set((x) => { x.company.branches.push(adding); }); setAdding(null); }}>{L('Add branch', 'إضافة')}</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L('ETA branch code', 'كود الفرع')}>{(id) => <Input id={id} dir="ltr" value={adding.code} onChange={(e) => setAdding({ ...adding, code: e.target.value })} />}</Field>
            <Field label={L('Name', 'الاسم')}>{(id) => <Input id={id} value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value, nameAr: adding.nameAr || e.target.value })} />}</Field>
            <Field label={L('Governorate', 'المحافظة')}>{(id) => <Select id={id} value={adding.address.governate} onChange={(e) => setAdding({ ...adding, address: { ...adding.address, governate: e.target.value } })}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</Select>}</Field>
            <Field label={L('City / district', 'المدينة')}>{(id) => <Input id={id} value={adding.address.regionCity} onChange={(e) => setAdding({ ...adding, address: { ...adding.address, regionCity: e.target.value } })} />}</Field>
            <Field label={L('Street', 'الشارع')}>{(id) => <Input id={id} value={adding.address.street} onChange={(e) => setAdding({ ...adding, address: { ...adding.address, street: e.target.value } })} />}</Field>
            <Field label={L('Building', 'المبنى')}>{(id) => <Input id={id} value={adding.address.buildingNumber} onChange={(e) => setAdding({ ...adding, address: { ...adding.address, buildingNumber: e.target.value } })} />}</Field>
          </div>
        </Modal>
      )}
    </Card>
  );
}

function IntegrationSection() {
  const { db, set } = useStore();
  const { L, date } = useI18n();
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<null | { ms: number }>(null);
  const [secret, setSecret] = useState('');
  const [envConfirm, setEnvConfirm] = useState<'preprod' | 'production' | null>(null);
  const it = db.integration;
  const host = (h: 'id' | 'api') => it.env === 'production' ? (h === 'id' ? 'https://id.eta.gov.eg' : 'https://api.invoicing.eta.gov.eg') : (h === 'id' ? 'https://id.preprod.eta.gov.eg' : 'https://api.preprod.invoicing.eta.gov.eg');
  const test = async () => {
    setTesting(true); setResult(null);
    const t = Date.now();
    await mockEta.login(); await mockEta.getDocumentTypes();
    set((x) => { x.integration.status = 'connected'; x.integration.lastTokenAt = new Date().toISOString(); });
    setResult({ ms: Date.now() - t }); setTesting(false);
  };
  return (
    <>
      <Card title={L('ETA connection', 'الربط مع المصلحة')} subtitle={L('Fatura signs in as your ERP system with OAuth2 client credentials. Secrets are encrypted server-side and never reach the browser.', 'تتصل فاتورة كنظام ERP خاص بك. الأسرار مشفرة على الخادم.')}
        action={it.status === 'connected' ? <Badge tone="ok" icon={<CheckCircle2 className="size-3" />}>{L('Connected', 'متصل')}</Badge> : <Badge tone="bad">{L('Not connected', 'غير متصل')}</Badge>}>
        <div className="space-y-5">
          <div>
            <span className="label">{L('Environment', 'البيئة')}</span>
            <Segmented value={it.env} onChange={(v) => v !== it.env && setEnvConfirm(v)} options={[{ value: 'preprod', label: L('Pre-production (testing)', 'بيئة الاختبار') }, { value: 'production', label: L('Production', 'الإنتاج') }]} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L('Client ID', 'معرّف العميل')}>{(id) => <Input id={id} dir="ltr" value={it.clientId} onChange={(e) => set((x) => { x.integration.clientId = e.target.value.trim(); })} className="font-mono text-[13px]" />}</Field>
            <Field label={L('Client secret', 'السر')} hint={it.secretSet ? L('Stored. Enter a new one to rotate it.', 'محفوظ. أدخل سراً جديداً لتغييره.') : undefined}>{(id) => <Input id={id} type="password" dir="ltr" placeholder={it.secretSet ? '••••••••••••••••' : ''} value={secret} onChange={(e) => setSecret(e.target.value)} />}</Field>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" icon={<KeyRound className="size-4" />} loading={testing} onClick={test}>{L('Test connection', 'اختبار الاتصال')}</Button>
            {secret && <Button onClick={() => { set((x) => { x.integration.secretSet = true; }); setSecret(''); toast({ tone: 'ok', text: L('Secret rotated.', 'تم تغيير السر.') }); }}>{L('Save secret', 'حفظ السر')}</Button>}
            {it.lastTokenAt && <span className="text-[12.5px] text-ink-subtle">{L('Last token issued', 'آخر رمز')} {date(it.lastTokenAt, 'datetime')}</span>}
          </div>
          {result && (
            <Callout tone="ok" title={L(`Token issued and document types loaded in ${result.ms} ms`, `تم إصدار الرمز وتحميل أنواع المستندات خلال ${result.ms} م.ث`)}>
              <ul className="mt-1 grid sm:grid-cols-2 gap-x-4">{DOCUMENT_TYPES.map((t) => <li key={t.code}>{t.name} v{t.activeVersion} · {L(`cancel within ${t.workflowParameters.cancellationWindowHours / 24} days`, `إلغاء خلال ${t.workflowParameters.cancellationWindowHours / 24} أيام`)}</li>)}</ul>
            </Callout>
          )}
          <details className="rounded-md border border-line bg-sunken/40 p-3.5 text-[13px]">
            <summary className="cursor-pointer font-medium text-ink">{L('Where do I get these?', 'من أين أحصل عليها؟')}</summary>
            <ol className="list-decimal ps-5 mt-2 space-y-1 text-ink-muted">
              <li>{L('Sign in to the ETA e-invoicing portal with the taxpayer administrator account.', 'سجّل الدخول لبوابة الفاتورة الإلكترونية بحساب مسؤول الممول.')}</li>
              <li>{L('Open the taxpayer profile → ERP systems, and register “Fatura” as a new ERP.', 'افتح ملف الممول ← أنظمة ERP، وسجّل "فاتورة" كنظام جديد.')}</li>
              <li>{L('Copy the generated client ID and secret here. Use the pre-production pair first and switch when your test invoices validate.', 'انسخ المعرّف والسر هنا. ابدأ ببيئة الاختبار ثم انتقل للإنتاج.')}</li>
            </ol>
          </details>
        </div>
      </Card>
      <Card title={L('API endpoints in use', 'واجهات المصلحة المستخدمة')} subtitle={`${host('id')} · ${host('api')}`} pad={false}>
        <Table>
          <thead><tr><Th>{L('Operation', 'العملية')}</Th><Th>{L('Method', 'الطريقة')}</Th><Th>{L('Path', 'المسار')}</Th></tr></thead>
          <tbody>{ENDPOINTS.map((e) => <tr key={e.op}><Td>{e.op}</Td><Td><Badge tone={e.method === 'GET' ? 'info' : e.method === 'POST' ? 'accent' : 'warn'}>{e.method}</Badge></Td><Td><Mono className="text-ink-muted">{e.path}</Mono></Td></tr>)}</tbody>
        </Table>
      </Card>
      <Modal open={!!envConfirm} onClose={() => setEnvConfirm(null)} size="sm" title={envConfirm === 'production' ? L('Switch to production?', 'التحويل للإنتاج؟') : L('Switch to pre-production?', 'التحويل لبيئة الاختبار؟')}
        footer={<><Button onClick={() => setEnvConfirm(null)}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" onClick={() => { set((x) => { x.integration.env = envConfirm!; x.integration.status = 'not_configured'; }); setEnvConfirm(null); }}>{L('Switch', 'تحويل')}</Button></>}>
        <p className="text-ink-muted">{envConfirm === 'production' ? L('Documents you submit will be legally issued. Enter your production client ID and secret, then test the connection.', 'المستندات التي ترسلها ستكون صادرة قانونياً. أدخل بيانات الإنتاج ثم اختبر الاتصال.') : L('Documents will go to the ETA test environment and have no tax effect.', 'ستُرسل المستندات لبيئة الاختبار دون أثر ضريبي.')}</p>
      </Modal>
    </>
  );
}

function SigningSection() {
  const { db, set } = useStore();
  const { L, date, rel } = useI18n();
  const toast = useToast();
  const [testing, setTesting] = useState(false);
  const s = db.signing;
  const days = Math.round((new Date(s.certificate.expires).getTime() - Date.now()) / 86_400_000);
  return (
    <>
      <Card title={L('How documents are signed', 'طريقة توقيع المستندات')} subtitle={L('ETA requires a CAdES-BES signature from a certificate issued to your company.', 'تتطلب المصلحة توقيعاً بشهادة صادرة لشركتك.')}>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
          {([
            ['usb-token', L('USB token + Fatura Signer', 'توكن USB + برنامج التوقيع'), L('A small Windows/macOS agent on the PC holding the token. Most common.', 'برنامج صغير على الجهاز المتصل بالتوكن. الأكثر شيوعاً.')],
            ['hsm', L('HSM (on-premise)', 'HSM داخلي'), L('For high volumes and unattended recurring submission.', 'للكميات الكبيرة والإرسال التلقائي.')],
            ['cloud', L('Cloud signing (eSeal)', 'توقيع سحابي'), L('A remote seal from a licensed provider — no hardware.', 'ختم عن بُعد من مزود مرخص — بلا أجهزة.')],
          ] as const).map(([k, t, d]) => (
            <button key={k} role="radio" aria-checked={s.method === k} onClick={() => set((x) => { x.signing.method = k; })}
              className={cx('text-start rounded-md border p-3', s.method === k ? 'border-accent ring-1 ring-accent bg-accent-soft/50' : 'border-line hover:border-ink-subtle/50')}>
              <span className={cx('block font-semibold', s.method === k ? 'text-accent' : 'text-ink')}>{t}</span>
              <span className="block mt-0.5 text-[12.5px] text-ink-muted">{d}</span>
            </button>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card title={L('Fatura Signer agent', 'وكيل التوقيع')} action={s.agent.status === 'online' ? <Badge tone="ok">{L('Online', 'متصل')}</Badge> : <Badge tone="bad">{L('Offline', 'غير متصل')}</Badge>}>
          <DescList cols={1} items={[
            { k: L('Machine', 'الجهاز'), v: <Mono>{s.agent.host}</Mono> },
            { k: L('Version', 'الإصدار'), v: s.agent.version },
            { k: L('Last heartbeat', 'آخر اتصال'), v: rel(s.agent.lastSeen) },
          ]} />
          <div className="flex flex-wrap gap-2 mt-4">
            <Button icon={<Download className="size-4" />} onClick={() => toast({ tone: 'info', text: L('Installer download started.', 'بدأ تنزيل البرنامج.') })}>{L('Download agent', 'تنزيل البرنامج')}</Button>
            <Button loading={testing} icon={<ShieldCheck className="size-4" />} onClick={async () => { setTesting(true); await new Promise((r) => setTimeout(r, 900)); setTesting(false); toast({ tone: 'ok', text: L('Test signature created and verified.', 'تم إنشاء توقيع تجريبي والتحقق منه.') }); }}>{L('Test signature', 'توقيع تجريبي')}</Button>
            <Button variant="ghost" onClick={() => set((x) => { x.signing.agent.status = x.signing.agent.status === 'online' ? 'offline' : 'online'; x.signing.agent.lastSeen = new Date().toISOString(); })}>{L('Simulate disconnect', 'محاكاة الانقطاع')}</Button>
          </div>
        </Card>
        <Card title={L('Signing certificate', 'شهادة التوقيع')}>
          <DescList cols={1} items={[
            { k: L('Subject', 'الموضوع'), v: <Mono className="break-all">{s.certificate.subject}</Mono> },
            { k: L('Issuer', 'المُصدر'), v: s.certificate.issuer },
            { k: L('Serial', 'الرقم التسلسلي'), v: <Mono>{s.certificate.serial}</Mono> },
            { k: L('Expires', 'تنتهي'), v: <span className={days < 60 ? 'text-warn font-medium' : ''}>{date(s.certificate.expires, 'long')} · {L(`${days} days`, `${days} يوماً`)}</span> },
          ]} />
          <Progress className="mt-4" value={days / 365} tone={days < 30 ? 'bad' : days < 60 ? 'warn' : 'ok'} />
        </Card>
      </div>
    </>
  );
}

function TeamSection() {
  const { db, set } = useStore();
  const { L, rel } = useI18n();
  const toast = useToast();
  const [invite, setInvite] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Member['role']>('Accountant');
  const roles: { r: Member['role']; d: string }[] = [
    { r: 'Owner', d: L('Everything, including billing and ETA credentials', 'كل الصلاحيات بما فيها الفوترة وبيانات المصلحة') },
    { r: 'Admin', d: L('Settings, team, and all documents', 'الإعدادات والفريق وكل المستندات') },
    { r: 'Accountant', d: L('Create, submit, cancel documents; reports', 'إنشاء وإرسال وإلغاء المستندات؛ التقارير') },
    { r: 'Sales', d: L('Create drafts and customers; cannot submit', 'إنشاء مسودات وعملاء؛ دون إرسال') },
    { r: 'Viewer', d: L('Read-only', 'قراءة فقط') },
  ];
  return (
    <>
      <Card title={L('Team', 'الفريق')} pad={false} action={<Button size="sm" variant="primary" icon={<UserPlus className="size-4" />} onClick={() => setInvite(true)}>{L('Invite', 'دعوة')}</Button>}>
        <Table>
          <thead><tr><Th>{L('Member', 'العضو')}</Th><Th>{L('Role', 'الدور')}</Th><Th>{L('Last active', 'آخر نشاط')}</Th></tr></thead>
          <tbody>{db.members.map((m) => (
            <tr key={m.id}>
              <Td><div className="flex items-center gap-3"><Avatar name={m.name} size={30} /><div><div className="font-medium">{m.name}</div><div className="text-[12px] text-ink-subtle">{m.email}</div></div></div></Td>
              <Td>{m.role === 'Owner' ? <Badge tone="accent">Owner</Badge> : (
                <Select value={m.role} className="w-auto h-8" aria-label={L('Role', 'الدور')} onChange={(e) => set((x) => { x.members.find((y) => y.id === m.id)!.role = e.target.value as Member['role']; })}>{roles.slice(1).map((r) => <option key={r.r}>{r.r}</option>)}</Select>
              )}</Td>
              <Td className="text-ink-muted">{m.status === 'invited' ? <Badge tone="warn">{L('Invited', 'مدعو')}</Badge> : m.lastActive ? rel(m.lastActive) : '—'}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <Card title={L('What each role can do', 'صلاحيات كل دور')}>
        <ul className="divide-y divide-line">{roles.map((r) => <li key={r.r} className="flex justify-between gap-4 py-2.5 text-[13.5px]"><span className="font-medium">{r.r}</span><span className="text-ink-muted text-end">{r.d}</span></li>)}</ul>
      </Card>
      <Modal open={invite} onClose={() => setInvite(false)} title={L('Invite a teammate', 'دعوة عضو')}
        footer={<><Button onClick={() => setInvite(false)}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" disabled={!/^\S+@\S+\.\S+$/.test(email)} onClick={() => { set((x) => { x.members.push({ id: uid('m'), name: email.split('@')[0], email, role, status: 'invited' }); }); setInvite(false); setEmail(''); toast({ tone: 'ok', text: L('Invitation sent.', 'تم إرسال الدعوة.') }); }}>{L('Send invite', 'إرسال الدعوة')}</Button></>}>
        <div className="grid gap-4">
          <Field label={L('Work email', 'البريد')}>{(id) => <Input id={id} type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          <Field label={L('Role', 'الدور')}>{(id) => <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Member['role'])}>{roles.slice(1).map((r) => <option key={r.r} value={r.r}>{r.r} — {r.d}</option>)}</Select>}</Field>
        </div>
      </Modal>
    </>
  );
}

function NumberingSection() {
  const { db, set } = useStore();
  const { L, money } = useI18n();
  const lb = useLabels();
  const toast = useToast();
  const [n, setN] = useState(db.settings.numbering);
  return (
    <>
      <Card title={L('Document numbering', 'ترقيم المستندات')} subtitle={L('Sent to ETA as internalID. Must be unique per issuer. Use {YYYY} and {#####}.', 'يُرسل كرقم داخلي. يجب أن يكون فريداً. استخدم {YYYY} و {#####}.')}>
        <div className="space-y-3">
          {(Object.keys(n) as (keyof typeof n)[]).map((k) => (
            <div key={k} className="grid gap-3 sm:grid-cols-[160px_minmax(0,1fr)_120px_minmax(0,1fr)] items-end">
              <div className="font-medium pb-2">{lb.docType(k)}</div>
              <Field label={L('Pattern', 'النمط')}>{(id) => <Input id={id} dir="ltr" value={n[k].pattern} onChange={(e) => setN({ ...n, [k]: { ...n[k], pattern: e.target.value } })} className="font-mono" />}</Field>
              <Field label={L('Next', 'التالي')}>{(id) => <Input id={id} type="number" min={1} value={n[k].next} onChange={(e) => setN({ ...n, [k]: { ...n[k], next: Number(e.target.value) } })} />}</Field>
              <div className="pb-2 text-ink-muted text-[13px]">{L('Next:', 'التالي:')} <Mono className="text-ink">{formatNumber(n[k].pattern, n[k].next)}</Mono></div>
            </div>
          ))}
        </div>
        <SaveBar onSave={() => { set((x) => { x.settings.numbering = n; }); toast({ tone: 'ok', text: L('Numbering saved.', 'تم حفظ الترقيم.') }); }} />
      </Card>
      <Card title={L('Defaults', 'الافتراضيات')}>
        <div className="space-y-5">
          <Field label={L('Default payment terms', 'شروط الدفع الافتراضية')}>{(id) => <Select id={id} className="max-w-xs" value={db.settings.defaultTerms} onChange={(e) => set((x) => { x.settings.defaultTerms = e.target.value as typeof x.settings.defaultTerms; })}>{(['receipt', 'net15', 'net30', 'net45', 'net60'] as const).map((t) => <option key={t} value={t}>{lb.terms(t)}</option>)}</Select>}</Field>
          <Switch checked={db.settings.autoEmail} onChange={(v) => set((x) => { x.settings.autoEmail = v; })} label={L('Email customers when a document becomes Valid', 'إرسال بريد للعميل عند اعتماد المستند')} description={L('Includes the PDF and the ETA verification link.', 'يتضمن ملف PDF ورابط التحقق.')} />
          <div className="rounded-md bg-sunken/60 border border-line p-3.5 text-[13px] text-ink-muted">{L('Individual receivers need a national ID from', 'يلزم الرقم القومي للأفراد من')} <span className="font-medium text-ink">{money(db.settings.personIdThreshold)}</span>. {L('Set by ETA; Fatura updates it centrally.', 'تحدده المصلحة وتحدّثه فاتورة مركزياً.')}</div>
        </div>
      </Card>
    </>
  );
}

function BillingSection() {
  const { db } = useStore();
  const { L, lang, money, date } = useI18n();
  const toast = useToast();
  const tenant = db.admin.tenants[0];
  const plan = db.admin.plans.find((p) => p.id === tenant.planId)!;
  const used = db.docs.filter((d) => d.direction === 'sent' && d.submittedAt?.startsWith(new Date().toISOString().slice(0, 7))).length;
  const [model, setModel] = useState<'monthly' | 'yearly' | 'one-time' | 'installments'>(tenant.cycle ?? 'monthly');
  const invoices = db.admin.invoices.filter((i) => i.tenantId === tenant.id);
  const price = { monthly: [plan.monthly, L('/ month', '/ شهر')], yearly: [plan.yearly, L('/ year', '/ سنة')], 'one-time': [plan.oneTime, L('once', 'مرة واحدة')], installments: [plan.installments.amount, L(`× ${plan.installments.count} installments`, `× ${plan.installments.count} أقساط`)] }[model] as [number, string];
  return (
    <>
      <Card title={L('Your Fatura plan', 'باقتك في فاتورة')}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><span className="text-[20px] font-semibold">{bi(lang, { en: plan.name, ar: plan.nameAr })}</span><Badge tone="accent">{tenant.cycle === 'yearly' ? L('Billed yearly', 'سنوي') : L('Billed monthly', 'شهري')}</Badge></div>
            <p className="text-ink-muted mt-1">{bi(lang, plan.blurb)}</p>
          </div>
          <div className="text-end"><div className="text-[22px] font-semibold tabular">{money(tenant.cycle === 'yearly' ? plan.yearly : plan.monthly)}</div><div className="text-[12.5px] text-ink-subtle">{L('+ 14% VAT', '+ ١٤٪ ضريبة')}</div></div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-[13px] mb-1.5"><span className="text-ink-muted">{L('Documents this month', 'المستندات هذا الشهر')}</span><span className="tabular">{used} / {plan.docsPerMonth.toLocaleString()}</span></div>
          <Progress value={used / plan.docsPerMonth} />
        </div>
      </Card>
      <Card title={L('Change how you pay', 'غيّر طريقة الدفع')} subtitle={L('Same features — pick the payment model that suits your cash flow.', 'نفس المزايا — اختر ما يناسب تدفقك النقدي.')}>
        <div role="radiogroup" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {([
            ['monthly', L('Monthly', 'شهري'), money(plan.monthly)],
            ['yearly', L('Yearly', 'سنوي'), `${money(plan.yearly)} · ${L('2 months free', 'شهران مجاناً')}`],
            ['installments', L('Yearly in installments', 'سنوي بالتقسيط'), `${plan.installments.count} × ${money(plan.installments.amount)}`],
            ['one-time', L('One-time licence', 'ترخيص دائم'), money(plan.oneTime)],
          ] as const).map(([k, t, p]) => (
            <button key={k} role="radio" aria-checked={model === k} onClick={() => setModel(k)} className={cx('text-start rounded-md border p-3', model === k ? 'border-accent ring-1 ring-accent bg-accent-soft/50' : 'border-line hover:border-ink-subtle/50')}>
              <span className={cx('block font-semibold', model === k ? 'text-accent' : 'text-ink')}>{t}</span>
              <span className="block text-[12.5px] text-ink-muted mt-0.5 tabular">{p}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <span className="text-ink-muted text-[13px]">{model === 'one-time' ? L('Includes 12 months of updates and ETA schema changes; renew updates yearly at 20%.', 'يشمل ١٢ شهراً من التحديثات؛ تجديد التحديثات سنوياً بنسبة ٢٠٪.') : model === 'installments' ? L('Interest-free. Each installment is invoiced to you as a valid ETA invoice.', 'بدون فوائد. كل قسط يصدر كفاتورة إلكترونية صالحة.') : L('Cancel or switch any time.', 'يمكنك الإلغاء أو التغيير في أي وقت.')}</span>
          <Button variant="primary" onClick={() => toast({ tone: 'ok', text: L(`Switched to ${model} billing from your next cycle.`, 'تم تغيير طريقة الدفع اعتباراً من الدورة القادمة.') })}>{L('Confirm', 'تأكيد')} · {money(price[0])} {price[1]}</Button>
        </div>
      </Card>
      <Card title={L('Invoices from Fatura', 'فواتير فاتورة')} pad={false}>
        <Table>
          <thead><tr><Th>{L('Number', 'الرقم')}</Th><Th>{L('Date', 'التاريخ')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('Amount', 'المبلغ')}</Th></tr></thead>
          <tbody>{invoices.map((i) => <tr key={i.id}><Td className="font-medium">{i.number}</Td><Td className="text-ink-muted">{date(i.issuedAt)}</Td><Td><Badge tone={i.status === 'paid' ? 'ok' : i.status === 'overdue' ? 'bad' : 'warn'}>{i.status}</Badge></Td><Td align="end"><Money value={i.amount + i.vat} /></Td></tr>)}</tbody>
        </Table>
      </Card>
    </>
  );
}

function DataSection() {
  const { reset } = useStore();
  const { L } = useI18n();
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Card title={L('Export everything', 'تصدير كل شيء')} subtitle={L('A full archive of documents (JSON as submitted, PDFs, validation results) for your auditors. ETA requires you to keep records for 5 years.', 'أرشيف كامل للمستندات للمراجعين. تتطلب المصلحة الاحتفاظ بالسجلات ٥ سنوات.')}>
        <Button icon={busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} onClick={async () => { setBusy(true); await new Promise((r) => setTimeout(r, 900)); setBusy(false); toast({ tone: 'ok', text: L('Archive is being prepared — we will email you a link.', 'جارٍ تجهيز الأرشيف — سنرسل لك رابطاً.') }); }}>{L('Request archive', 'طلب الأرشيف')}</Button>
      </Card>
      <Card title={L('Demo data', 'بيانات العرض')} subtitle={L('This workspace runs on a simulated ETA backend. Reset to restore the sample company.', 'تعمل مساحة العمل على محاكاة لخادم المصلحة. أعد الضبط لاستعادة بيانات العرض.')}>
        <Button variant="secondary" icon={<RotateCcw className="size-4" />} onClick={() => setConfirm(true)}>{L('Reset demo data', 'إعادة ضبط البيانات')}</Button>
      </Card>
      <Card title={L('Server', 'الخادم')}><p className="text-ink-muted text-[13px] flex items-center gap-2"><Server className="size-4" />{L('Data residency: Egypt (Cairo region). Encrypted at rest, TLS 1.3 in transit.', 'إقامة البيانات: مصر. مشفرة أثناء التخزين والنقل.')}</p></Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} size="sm" title={L('Reset demo data?', 'إعادة ضبط البيانات؟')}
        footer={<><Button onClick={() => setConfirm(false)}>{L('Cancel', 'إلغاء')}</Button><Button variant="danger" onClick={() => { reset(); setConfirm(false); toast({ tone: 'ok', text: L('Demo data restored.', 'تمت استعادة البيانات.') }); }}>{L('Reset', 'إعادة الضبط')}</Button></>}>
        <p className="text-ink-muted">{L('All changes you made in this browser are replaced with the sample data.', 'ستُستبدل كل تغييراتك ببيانات العرض.')}</p>
      </Modal>
    </>
  );
}
