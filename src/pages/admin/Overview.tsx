import { AlertTriangle, ArrowRight, Building2, CreditCard, FileCheck2, TrendingUp } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { BarChart, LineChart } from '@/components/charts';
import { Badge, Card, Money, PageHeader, Stat, Table, Td, Th } from '@/components/ui';
import { TenantStatus } from './Tenants';

export function AdminOverview() {
  const { db } = useStore();
  const { L, num, money, date, lang } = useI18n();
  const { tenants, api, invoices, plans } = db.admin;
  const mrr = tenants.reduce((s, t) => s + t.mrr, 0);
  const last30 = api.reduce((s, d) => s + d.submitted, 0);
  const invalid = api.reduce((s, d) => s + d.invalid, 0);
  const pastDue = tenants.filter((t) => t.status === 'past_due');
  const offline = tenants.filter((t) => t.signer === 'offline' && t.status === 'active');
  const overdue = invoices.filter((i) => i.status === 'overdue').reduce((s, i) => s + i.amount + i.vat, 0);
  const fmtDay = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(d));
  const mrrSeries = useMemo(() => Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - (11 - i));
    const active = tenants.filter((t) => new Date(t.createdAt) <= d);
    return { label: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'short' }).format(d), value: active.reduce((s, t) => s + t.mrr, 0) };
  }), [tenants, lang]);
  const byModel = (['recurring', 'installments', 'one-time'] as const).map((m) => ({ m, n: tenants.filter((t) => t.model === m).length }));

  return (
    <div className="animate-in">
      <PageHeader title={L('Platform overview', 'نظرة عامة على المنصة')} description={L('Fatura across all tenants — revenue, ETA traffic and accounts that need a hand.', 'فاتورة عبر كل الشركات — الإيراد وحركة المصلحة والحسابات التي تحتاج مساعدة.')} />
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 mb-6">
        <Stat label={L('Monthly recurring revenue', 'الإيراد الشهري المتكرر')} value={money(mrr, 'EGP', { compact: true })} hint={L('incl. installment plans', 'يشمل خطط التقسيط')} icon={<TrendingUp className="size-4" />} />
        <Stat label={L('Active tenants', 'الشركات النشطة')} value={tenants.filter((t) => t.status === 'active').length} hint={L(`${tenants.filter((t) => t.status === 'trial').length} on trial`, `${tenants.filter((t) => t.status === 'trial').length} تجريبي`)} icon={<Building2 className="size-4" />} />
        <Stat label={L('Documents to ETA · 30d', 'مستندات للمصلحة · ٣٠ يوماً')} value={num(last30)} hint={L(`${((invalid / last30) * 100).toFixed(2)}% invalid`, `${((invalid / last30) * 100).toFixed(2)}٪ غير صالحة`)} icon={<FileCheck2 className="size-4" />} />
        <Stat label={L('Overdue platform invoices', 'فواتير المنصة المتأخرة')} value={money(overdue, 'EGP', { compact: true })} tone="bad" delta={L(`${pastDue.length} tenants`, `${pastDue.length} شركة`)} icon={<CreditCard className="size-4" />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <Card title={L('MRR', 'الإيراد الشهري المتكرر')} subtitle={L('Last 12 months', 'آخر ١٢ شهراً')}><LineChart data={mrrSeries} format={(n) => money(n, 'EGP', { compact: true })} ariaLabel="MRR" /></Card>
        <Card title={L('Documents submitted per day', 'المستندات المرسلة يومياً')} subtitle={L('All tenants, last 30 days', 'كل الشركات، آخر ٣٠ يوماً')}>
          <BarChart data={api.map((d) => ({ label: fmtDay(d.date), value: d.submitted, sub: L(`${d.invalid} invalid`, `${d.invalid} غير صالح`) }))} format={(n) => num(n)} ariaLabel={L('Documents per day', 'المستندات يومياً')} highlightLast />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" title={L('Needs attention', 'تحتاج انتباهاً')} pad={false} action={<Link to="/admin/tenants" className="text-[13px] link">{L('All tenants', 'كل الشركات')}</Link>}>
          <Table>
            <thead><tr><Th>{L('Tenant', 'الشركة')}</Th><Th>{L('Issue', 'المشكلة')}</Th><Th>{L('Status', 'الحالة')}</Th><Th /></tr></thead>
            <tbody>
              {[...pastDue.map((t) => ({ t, issue: L('Platform invoice overdue', 'فاتورة المنصة متأخرة') })), ...offline.map((t) => ({ t, issue: L('Signer offline — recurring runs queued', 'التوقيع غير متصل — فواتير متكررة معلقة') })), ...tenants.filter((t) => t.invalidRate > 4.5).map((t) => ({ t, issue: L(`High invalid rate: ${t.invalidRate}%`, `نسبة رفض مرتفعة: ${t.invalidRate}٪`) }))].filter((x, i, a) => a.findIndex((y) => y.t.id === x.t.id) === i).slice(0, 8).map(({ t, issue }, i) => (
                <tr key={t.id + i} className="hover:bg-sunken/50">
                  <Td><Link to={`/admin/tenants/${t.id}`} className="font-medium text-ink hover:text-accent">{t.name}</Link></Td>
                  <Td className="text-ink-muted"><span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-warn" />{issue}</span></Td>
                  <Td><TenantStatus s={t.status} /></Td>
                  <Td align="end"><Link to={`/admin/tenants/${t.id}`} aria-label={t.name}><ArrowRight className="size-4 text-ink-subtle rtl:rotate-180" /></Link></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title={L('How tenants pay', 'كيف تدفع الشركات')}>
          <ul className="space-y-3">
            {byModel.map(({ m, n }) => (
              <li key={m}>
                <div className="flex justify-between text-[13.5px]"><span>{{ recurring: L('Recurring (monthly / yearly)', 'متكرر (شهري / سنوي)'), installments: L('Installments', 'تقسيط'), 'one-time': L('One-time licence', 'ترخيص دائم') }[m]}</span><span className="tabular font-medium">{n}</span></div>
                <div className="h-1.5 rounded-full bg-sunken mt-1.5"><div className="h-full rounded-full bg-accent" style={{ width: `${(n / tenants.length) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
          <div className="mt-6 pt-4 border-t border-line">
            <div className="text-[12.5px] text-ink-muted mb-2">{L('Plans', 'الباقات')}</div>
            <div className="flex flex-wrap gap-2">{plans.map((p) => <Badge key={p.id} tone={p.featured ? 'accent' : 'neutral'}>{p.name} · {tenants.filter((t) => t.planId === p.id).length}</Badge>)}</div>
          </div>
          <div className="mt-6 pt-4 border-t border-line text-[12.5px] text-ink-muted">{L('Latest platform invoice', 'أحدث فاتورة منصة')}: {invoices[0]?.number} · {date(invoices[0]?.issuedAt)} · <Money value={invoices[0]?.amount ?? 0} /></div>
        </Card>
      </div>
    </div>
  );
}
