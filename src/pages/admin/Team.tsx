import { ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Segmented, Switch, Table, Td, Th, useToast } from '@/components/ui';

export function AdminTeam() {
  const { db } = useStore();
  const { L, rel } = useI18n();
  const toast = useToast();
  const perms: [string, string, boolean[]][] = [
    [L('View tenants & usage', 'عرض الشركات والاستخدام'), '', [true, true, true, true]],
    [L('Support session (read-only)', 'جلسة دعم (قراءة فقط)'), '', [true, true, false, false]],
    [L('Suspend / reactivate tenants', 'إيقاف / تفعيل الشركات'), '', [true, false, false, false]],
    [L('Edit plans & prices', 'تعديل الباقات والأسعار'), '', [true, false, true, false]],
    [L('Mark invoices paid, refunds', 'تعليم الفواتير مدفوعة والاسترداد'), '', [true, false, true, false]],
    [L('Sync reference data', 'مزامنة البيانات المرجعية'), '', [true, true, false, false]],
  ];
  return (
    <div className="animate-in">
      <PageHeader title={L('Admin team & roles', 'فريق الإدارة والأدوار')} description={L('Fatura staff. Tenant data is never editable from here — support sessions are read-only and audited.', 'موظفو فاتورة. لا يمكن تعديل بيانات الشركات من هنا — جلسات الدعم للقراءة فقط ومسجلة.')}
        actions={<Button variant="primary" icon={<UserPlus className="size-4" />} onClick={() => toast({ tone: 'info', text: L('Staff invites require a @fatura.eg address and hardware MFA.', 'دعوات الموظفين تتطلب بريد fatura.eg ومفتاح أمان.') })}>{L('Invite staff', 'دعوة موظف')}</Button>} />
      <Card pad={false} className="mb-5">
        <Table>
          <thead><tr><Th>{L('Member', 'العضو')}</Th><Th>{L('Role', 'الدور')}</Th><Th>MFA</Th><Th>{L('Last active', 'آخر نشاط')}</Th></tr></thead>
          <tbody>{db.admin.users.map((u) => (
            <tr key={u.id}>
              <Td><div className="flex items-center gap-3"><Avatar name={u.name} size={30} /><div><div className="font-medium">{u.name}</div><div className="text-[12px] text-ink-subtle">{u.email}</div></div></div></Td>
              <Td><Badge tone={u.role === 'Super admin' ? 'accent' : 'neutral'}>{u.role}</Badge></Td>
              <Td>{u.mfa ? <Badge tone="ok" icon={<ShieldCheck className="size-3" />}>{L('On', 'مفعل')}</Badge> : <Badge tone="bad">{L('Off — required', 'غير مفعل — مطلوب')}</Badge>}</Td>
              <Td className="text-ink-muted">{rel(u.lastActive)}</Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <Card title={L('Permissions', 'الصلاحيات')} pad={false}>
        <Table>
          <thead><tr><Th>{L('Capability', 'الصلاحية')}</Th>{['Super admin', 'Support', 'Finance', 'Read-only'].map((r) => <Th key={r}>{r}</Th>)}</tr></thead>
          <tbody>{perms.map(([k, , v]) => <tr key={k}><Td>{k}</Td>{v.map((x, i) => <Td key={i}>{x ? <span className="text-ok font-semibold" aria-label={L('Allowed', 'مسموح')}>✓</span> : <span className="text-ink-subtle" aria-label={L('Not allowed', 'غير مسموح')}>—</span>}</Td>)}</tr>)}</tbody>
        </Table>
      </Card>
    </div>
  );
}

export function PlatformSettings() {
  const { db, set } = useStore();
  const { L } = useI18n();
  const toast = useToast();
  const [threshold, setThreshold] = useState(db.settings.personIdThreshold);
  const [trial, setTrial] = useState(14);
  const [flags, setFlags] = useState({ receipts: true, cloudSigning: true, whatsapp: false, maintenance: false });
  return (
    <div className="animate-in">
      <PageHeader title={L('Platform settings', 'إعدادات المنصة')} description={L('Defaults that apply to every tenant.', 'افتراضيات تنطبق على كل الشركات.')} />
      <div className="space-y-5 max-w-[760px]">
        <SiteBanner />
        <Card title={L('ETA rules', 'قواعد المصلحة')} subtitle={L('Update when ETA publishes a change; tenants pick it up immediately.', 'حدّثها عند نشر المصلحة لتغيير.')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L('National ID threshold for individuals (EGP)', 'حد الرقم القومي للأفراد (جنيه)')}>{(id) => <Input id={id} type="number" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />}</Field>
            <Field label={L('Free trial length (days)', 'مدة التجربة (أيام)')}>{(id) => <Input id={id} type="number" value={trial} onChange={(e) => setTrial(Number(e.target.value))} />}</Field>
          </div>
          <div className="flex justify-end mt-4"><Button variant="primary" onClick={() => { set((x) => { x.settings.personIdThreshold = threshold; }); toast({ tone: 'ok', text: L('Saved and pushed to all tenants.', 'تم الحفظ والنشر لكل الشركات.') }); }}>{L('Save', 'حفظ')}</Button></div>
        </Card>
        <Card title={L('Feature flags', 'خصائص التشغيل')}>
          <div className="space-y-4">
            <Switch checked={flags.receipts} onChange={(v) => setFlags({ ...flags, receipts: v })} label={L('E-receipts (POS)', 'الإيصالات الإلكترونية')} description={L('Available on Scale.', 'متاحة في باقة التوسع.')} />
            <Switch checked={flags.cloudSigning} onChange={(v) => setFlags({ ...flags, cloudSigning: v })} label={L('Cloud signing (eSeal)', 'التوقيع السحابي')} />
            <Switch checked={flags.whatsapp} onChange={(v) => setFlags({ ...flags, whatsapp: v })} label={L('WhatsApp invoice delivery (beta)', 'إرسال الفواتير عبر واتساب (تجريبي)')} />
            <Switch checked={flags.maintenance} onChange={(v) => setFlags({ ...flags, maintenance: v })} label={L('Maintenance banner', 'شريط الصيانة')} description={L('Shows a banner in every workspace; submissions keep queueing.', 'يظهر شريط في كل المساحات؛ يستمر حفظ الإرسال.')} />
          </div>
        </Card>
      </div>
    </div>
  );
}

/** Website announcement bar. Edits here show on every public page immediately. */
function SiteBanner() {
  const { db, set } = useStore();
  const { L } = useI18n();
  const toast = useToast();
  const [b, setB] = useState(db.admin.site.banner);
  return (
    <Card title={L('Website announcement', 'إعلان الموقع')} subtitle={L('The bar at the top of every public page.', 'الشريط أعلى كل صفحات الموقع.')} action={<Link to="/" className="text-[13px] link">{L('View website', 'عرض الموقع')}</Link>}>
      <div className="space-y-4">
        <Switch checked={b.on} onChange={(v) => setB({ ...b, on: v })} label={L('Show the announcement', 'إظهار الإعلان')} />
        <Segmented value={b.tone} onChange={(v) => setB({ ...b, tone: v })} options={[{ value: 'info', label: L('News', 'خبر') }, { value: 'warn', label: L('Warning', 'تحذير') }]} />
        <Field label={L('Text (English)', 'النص (إنجليزي)')}>{(id) => <Input id={id} value={b.text.en} onChange={(e) => setB({ ...b, text: { ...b.text, en: e.target.value } })} />}</Field>
        <Field label={L('Text (Arabic)', 'النص (عربي)')}>{(id) => <Input id={id} dir="rtl" value={b.text.ar} onChange={(e) => setB({ ...b, text: { ...b.text, ar: e.target.value } })} />}</Field>
        <Field label={L('Link', 'الرابط')} optional hint={L('A website path such as /payments.', 'مسار في الموقع مثل /payments.')}>{(id) => <Input id={id} dir="ltr" value={b.link ?? ''} onChange={(e) => setB({ ...b, link: e.target.value || undefined })} />}</Field>
        <div className="flex justify-end"><Button variant="primary" onClick={() => { set((x) => { x.admin.site.banner = b; }); toast({ tone: 'ok', text: L('Announcement published to the website.', 'تم نشر الإعلان على الموقع.') }); }}>{L('Publish', 'نشر')}</Button></div>
      </div>
    </Card>
  );
}
