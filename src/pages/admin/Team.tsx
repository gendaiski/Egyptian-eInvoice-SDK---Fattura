import { ShieldCheck, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Avatar, Badge, Button, Card, Field, Input, PageHeader, Segmented, Switch, Table, Td, Th, useToast } from '@/components/ui';

export function AdminTeam() {
  const { db } = useStore();
  const { L, rel } = useI18n();
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
      <PageHeader title={L('Admin team & roles', 'فريق الإدارة والأدوار')} description={L('Fattura staff. Tenant data is never editable from here — support sessions are read-only and audited.', 'موظفو فاتورة. لا يمكن تعديل بيانات الشركات من هنا — جلسات الدعم للقراءة فقط ومسجلة.')}
        actions={<Button variant="primary" icon={<UserPlus className="size-4" />} disabled title={L('Staff invitations and MFA enrollment are not configured', 'الدعوات وتسجيل التحقق الثنائي غير مفعّلين')}>{L('Invites unavailable', 'الدعوات غير متاحة')}</Button>} />
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
  const { L } = useI18n();
  return (
    <div className="animate-in">
      <PageHeader title={L('Platform settings', 'إعدادات المنصة')} description={L('Website announcement is active. Platform-wide feature switches require a server-backed rollout system before they can be changed here.', 'إعلان الموقع فعال. مفاتيح الخصائص تحتاج نظام نشر على الخادم قبل تغييرها هنا.')} />
      <div className="space-y-5 max-w-[760px]">
        <SiteBanner />
        <Card title={L('Planned server controls', 'تحكم الخادم المخطط')} subtitle={L('These controls are not active in this Beta.', 'هذه الخصائص غير فعالة في النسخة التجريبية.')}>
          <ul className="space-y-2 text-[13px] text-ink-muted"><li>{L('Global tax-rule rollout and trial duration', 'نشر قواعد الضرائب ومدة التجربة')}</li><li>{L('E-receipts and cloud-signing feature flags', 'مفاتيح الإيصالات والتوقيع السحابي')}</li><li>{L('WhatsApp delivery and maintenance mode', 'إرسال واتساب ووضع الصيانة')}</li></ul>
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
