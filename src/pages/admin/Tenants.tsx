import { ArrowLeft, Eye, Pause, Play, Search } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '@/i18n';
import type { Tenant } from '@/store/model';
import { useStore } from '@/store/store';
import { Badge, Button, Card, DescList, Input, Modal, Money, Mono, PageHeader, Progress, Select, Table, Td, Th, Textarea, useToast } from '@/components/ui';
import { NotFound } from '../NotFound';

export function TenantStatus({ s }: { s: Tenant['status'] }) {
  const { L } = useI18n();
  const m = { active: ['ok', L('Active', 'نشط')], trial: ['info', L('Trial', 'تجريبي')], past_due: ['bad', L('Past due', 'متأخر السداد')], suspended: ['neutral', L('Suspended', 'موقوف')] } as const;
  return <Badge tone={m[s][0]}>{m[s][1]}</Badge>;
}

export function ModelLabel({ t }: { t: Tenant }) {
  const { L } = useI18n();
  return <>{t.model === 'recurring' ? (t.cycle === 'yearly' ? L('Yearly', 'سنوي') : L('Monthly', 'شهري')) : t.model === 'installments' ? L('Installments', 'تقسيط') : L('One-time', 'مرة واحدة')}</>;
}

export function Tenants() {
  const { db } = useStore();
  const { L, num } = useI18n();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [plan, setPlan] = useState('');
  const rows = db.admin.tenants.filter((t) => (!status || t.status === status) && (!plan || t.planId === plan) && (!q || `${t.name} ${t.rin} ${t.owner}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="animate-in">
      <PageHeader title={L('Tenants', 'الشركات المشتركة')} description={L('Every taxpayer company on Fatura.', 'كل الشركات الممولة على فاتورة.')} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 p-4">
          <div className="relative flex-1 min-w-[220px] max-w-[340px]"><Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Name, RIN or owner', 'الاسم أو الرقم الضريبي أو المالك')} aria-label={L('Search', 'بحث')} /></div>
          <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value)} aria-label={L('Status', 'الحالة')}><option value="">{L('All statuses', 'كل الحالات')}</option><option value="active">{L('Active', 'نشط')}</option><option value="trial">{L('Trial', 'تجريبي')}</option><option value="past_due">{L('Past due', 'متأخر')}</option><option value="suspended">{L('Suspended', 'موقوف')}</option></Select>
          <Select className="w-auto" value={plan} onChange={(e) => setPlan(e.target.value)} aria-label={L('Plan', 'الباقة')}><option value="">{L('All plans', 'كل الباقات')}</option>{db.admin.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</Select>
        </div>
        <Table>
          <thead><tr><Th>{L('Tenant', 'الشركة')}</Th><Th>{L('Plan', 'الباقة')}</Th><Th>{L('Billing', 'الدفع')}</Th><Th>{L('ETA', 'المصلحة')}</Th><Th>{L('Usage this month', 'الاستخدام')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">MRR</Th></tr></thead>
          <tbody>{rows.map((t) => {
            const p = db.admin.plans.find((x) => x.id === t.planId)!;
            return (
              <tr key={t.id} className="hover:bg-sunken/50 cursor-pointer" onClick={() => nav(`/admin/tenants/${t.id}`)}>
                <Td><Link to={`/admin/tenants/${t.id}`} className="font-medium text-ink hover:text-accent">{t.name}</Link><div className="text-[12px] text-ink-subtle"><Mono>{t.rin}</Mono> · {t.governorate}</div></Td>
                <Td>{p.name}</Td>
                <Td className="text-ink-muted"><ModelLabel t={t} /></Td>
                <Td><Badge tone={t.env === 'production' ? 'ok' : 'warn'}>{t.env === 'production' ? L('Production', 'إنتاج') : L('Pre-prod', 'اختبار')}</Badge></Td>
                <Td className="min-w-[150px]"><div className="text-[12px] tabular text-ink-muted mb-1">{num(t.docsThisMonth)} / {num(p.docsPerMonth)}</div><Progress value={t.docsThisMonth / p.docsPerMonth} tone={t.docsThisMonth / p.docsPerMonth > 0.9 ? 'warn' : 'accent'} /></Td>
                <Td><TenantStatus s={t.status} /></Td>
                <Td align="end"><Money value={t.mrr} /></Td>
              </tr>
            );
          })}</tbody>
        </Table>
      </Card>
    </div>
  );
}

export function TenantDetail() {
  const { id } = useParams();
  const { db, set } = useStore();
  const { L, date, num } = useI18n();
  const toast = useToast();
  const nav = useNavigate();
  const [suspend, setSuspend] = useState(false);
  const [reason, setReason] = useState('');
  const t = db.admin.tenants.find((x) => x.id === id);
  if (!t) return <NotFound />;
  const p = db.admin.plans.find((x) => x.id === t.planId)!;
  const invoices = db.admin.invoices.filter((i) => i.tenantId === t.id);
  const audit = db.admin.audit.filter((a) => a.tenantId === t.id).slice(0, 8);
  const patch = (fn: (x: Tenant) => void) => set((d) => { fn(d.admin.tenants.find((y) => y.id === t.id)!); });
  return (
    <div className="animate-in">
      <PageHeader back={<Link to="/admin/tenants" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink mb-2"><ArrowLeft className="size-4 rtl:rotate-180" />{L('Tenants', 'الشركات')}</Link>}
        title={<span className="flex items-center gap-3">{t.name}<TenantStatus s={t.status} /></span>}
        description={<>RIN <Mono>{t.rin}</Mono> · {t.owner} · {L('since', 'منذ')} {date(t.createdAt)}</>}
        actions={<>
          {t.status === 'suspended'
            ? <Button icon={<Play className="size-4" />} onClick={() => { patch((x) => { x.status = 'active'; }); toast({ tone: 'ok', text: L('Tenant reactivated.', 'تمت إعادة التفعيل.') }); }}>{L('Reactivate', 'إعادة التفعيل')}</Button>
            : <Button icon={<Pause className="size-4" />} onClick={() => setSuspend(true)}>{L('Suspend', 'إيقاف')}</Button>}
          <Button variant="primary" icon={<Eye className="size-4" />} onClick={() => { toast({ tone: 'info', text: L('Read-only support session started. Logged to the audit trail.', 'بدأت جلسة دعم للقراءة فقط. مسجلة في سجل التدقيق.') }); nav('/app'); }}>{L('View as support', 'عرض كدعم فني')}</Button>
        </>} />
      <div className="grid gap-5 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-5">
          <Card title={L('Subscription', 'الاشتراك')}>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><span className="label">{L('Plan', 'الباقة')}</span><Select value={t.planId} onChange={(e) => { patch((x) => { x.planId = e.target.value; }); toast({ tone: 'ok', text: L('Plan changed — prorated on the next invoice.', 'تم تغيير الباقة — تُحتسب نسبياً في الفاتورة القادمة.') }); }}>{db.admin.plans.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</Select></div>
              <div><span className="label">{L('Billing model', 'نموذج الدفع')}</span><div className="h-9 flex items-center"><ModelLabel t={t} />{t.model === 'installments' && <span className="ms-2 text-ink-muted text-[13px]">· {t.installmentsPaid}/{p.installments.count} {L('paid', 'مدفوعة')}</span>}</div></div>
              <div><span className="label">MRR</span><div className="h-9 flex items-center"><Money value={t.mrr} className="font-semibold" /></div></div>
            </div>
            <div className="mt-5"><div className="flex justify-between text-[13px] mb-1.5"><span className="text-ink-muted">{L('Documents this month', 'المستندات هذا الشهر')}</span><span className="tabular">{num(t.docsThisMonth)} / {num(p.docsPerMonth)}</span></div><Progress value={t.docsThisMonth / p.docsPerMonth} /></div>
          </Card>
          <Card title={L('Platform invoices', 'فواتير المنصة')} pad={false}>
            <Table>
              <thead><tr><Th>{L('Number', 'الرقم')}</Th><Th>{L('Issued', 'الإصدار')}</Th><Th>{L('Type', 'النوع')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('Amount', 'المبلغ')}</Th></tr></thead>
              <tbody>{invoices.length ? invoices.map((i) => <tr key={i.id}><Td className="font-medium">{i.number}</Td><Td className="text-ink-muted">{date(i.issuedAt)}</Td><Td className="text-ink-muted">{i.installment ? L(`Installment ${i.installment}`, `قسط ${i.installment}`) : i.model}</Td><Td><Badge tone={i.status === 'paid' ? 'ok' : i.status === 'overdue' ? 'bad' : i.status === 'void' ? 'neutral' : 'warn'}>{i.status}</Badge></Td><Td align="end"><Money value={i.amount + i.vat} /></Td></tr>) : <tr><Td className="text-ink-muted">{L('No invoices yet (trial).', 'لا فواتير بعد (تجريبي).')}</Td></tr>}</tbody>
            </Table>
          </Card>
        </div>
        <div className="space-y-5">
          <Card title={L('Health', 'الحالة الفنية')}>
            <DescList cols={1} items={[
              { k: L('ETA environment', 'بيئة المصلحة'), v: t.env === 'production' ? L('Production', 'الإنتاج') : L('Pre-production', 'الاختبار') },
              { k: L('Signer', 'التوقيع'), v: <Badge tone={t.signer === 'online' ? 'ok' : 'bad'}>{t.signer}</Badge> },
              { k: L('Invalid rate (30d)', 'نسبة الرفض'), v: <span className={t.invalidRate > 4.5 ? 'text-bad font-medium' : ''}>{t.invalidRate}%</span> },
              { k: L('Governorate', 'المحافظة'), v: t.governorate },
            ]} />
          </Card>
          <Card title={L('Recent activity', 'النشاط الأخير')}>
            <ul className="space-y-2.5 text-[13px]">{audit.length ? audit.map((a) => <li key={a.id}><Mono className="text-ink">{a.action}</Mono><div className="text-[12px] text-ink-subtle">{a.actor} · {date(a.at, 'datetime')}</div></li>) : <li className="text-ink-muted">—</li>}</ul>
          </Card>
        </div>
      </div>
      <Modal open={suspend} onClose={() => setSuspend(false)} title={L(`Suspend ${t.name}?`, `إيقاف ${t.name}؟`)}
        footer={<><Button onClick={() => setSuspend(false)}>{L('Cancel', 'إلغاء')}</Button><Button variant="danger" disabled={reason.length < 3} onClick={() => { patch((x) => { x.status = 'suspended'; }); setSuspend(false); toast({ tone: 'ok', text: L('Tenant suspended.', 'تم الإيقاف.') }); }}>{L('Suspend', 'إيقاف')}</Button></>}>
        <p className="text-ink-muted mb-4">{L('Users can still sign in, view and export their documents (they must keep records), but cannot submit to ETA.', 'يمكن للمستخدمين الدخول والتصدير لكن لا يمكنهم الإرسال للمصلحة.')}</p>
        <Textarea aria-label={L('Reason', 'السبب')} placeholder={L('Reason (visible to the tenant owner)', 'السبب (يظهر لمالك الحساب)')} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Modal>
    </div>
  );
}
