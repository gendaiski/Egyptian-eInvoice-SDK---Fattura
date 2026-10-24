import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ENDPOINTS } from '@/eta/client';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { api } from '@/lib/api';
import { BarChart, LineChart } from '@/components/charts';
import { Badge, Button, Callout, Card, Mono, PageHeader, Select, Stat, Table, Td, Th, useToast } from '@/components/ui';

export function EtaHealth() {
  const { db, reload, mode } = useStore();
  const { L, num, lang } = useI18n();
  const toast = useToast();
  const [retrying, setRetrying] = useState(false);
  const [tenantId, setTenantId] = useState(db.admin.tenants[0]?.id ?? '');
  const [pending, setPending] = useState<number | null>(null);
  useEffect(() => { if (mode === 'api') api<{ counts: { submitted: number } }>('GET', '/operations/status').then((s) => setPending(s.counts.submitted)).catch(() => setPending(null)); }, [mode]);
  const apiDays = db.admin.api;
  const fmtDay = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(d));
  const total = apiDays.reduce((s, d) => s + d.submitted, 0);
  const errors = apiDays.reduce((s, d) => s + d.errors, 0);
  const incident = apiDays.reduce((a, d) => (d.errors > a.errors ? d : a), apiDays[0]);
  const p95 = [...apiDays].sort((a, b) => a.p95 - b.p95)[Math.floor(apiDays.length * 0.95)]?.p95 ?? 0;
  const errorCodes = [
    { code: 'ItemCodeNotActive', validator: 'Code validator', share: 41 },
    { code: 'ReceiverNotRegistered', validator: 'Taxpayer validator', share: 18 },
    { code: 'DuplicateInternalId', validator: 'Core fields validator', share: 14 },
    { code: 'TotalMismatch', validator: 'Document totals validator', share: 11 },
    { code: 'SignatureInvalid', validator: 'Signature validator', share: 9 },
    { code: 'IssuedDateOutOfRange', validator: 'Core fields validator', share: 7 },
  ];
  return (
    <div className="animate-in">
      <PageHeader title={L('ETA integration health', 'صحة الربط مع المصلحة')} description={L('Simulator retry and illustrative seeded traffic charts. Use Beta operations for live server counts.', 'إعادة المحاولة في المحاكي ورسوم بيانية توضيحية. راجع تشغيل النسخة التجريبية للبيانات الفعلية.')}
        actions={<div className="flex gap-2"><Select aria-label={L('Tenant for simulator retry', 'الشركة لإعادة المحاولة')} value={tenantId} onChange={(e) => setTenantId(e.target.value)}>{db.admin.tenants.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select><Button icon={<RefreshCw className={retrying ? 'size-4 animate-spin' : 'size-4'} />} disabled={retrying || !tenantId || mode !== 'api'} onClick={async () => { setRetrying(true); try { const result = await api<{ completed: number }>('POST', '/operations/eta/retry-simulator', { tenantId }); await reload(); setPending((await api<{ counts: { submitted: number } }>('GET', '/operations/status')).counts.submitted); toast({ tone: 'ok', text: L(`${result.completed} simulator document(s) updated.`, `تم تحديث ${result.completed} مستند في المحاكي.`) }); } catch (e) { toast({ tone: 'bad', text: (e as Error).message }); } finally { setRetrying(false); } }}>{L('Retry simulator', 'إعادة المحاكي')}</Button></div>} />
      <Callout tone="warn" title={L(`Incident on ${fmtDay(incident.date)}: ${incident.errors} transport errors`, `حادث في ${fmtDay(incident.date)}: ${incident.errors} خطأ اتصال`)} icon={<AlertTriangle className="size-[18px]" />}>
        {L('Illustrative incident from the seeded demo dataset. This is not a live ETA outage report.', 'حادث توضيحي من بيانات العرض وليس تقريراً فعلياً عن المصلحة.')}
      </Callout>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 my-5">
        <Stat label={L('Submitted · 30d', 'مُرسلة · ٣٠ يوماً')} value={num(total)} />
        <Stat label={L('Transport success', 'نجاح الاتصال')} value={`${(100 - (errors / total) * 100).toFixed(2)}%`} icon={<CheckCircle2 className="size-4 text-ok" />} />
        <Stat label={L('p95 latency (submit)', 'زمن الاستجابة p95')} value={`${num(p95)} ms`} />
        <Stat label={L('Awaiting ETA result', 'بانتظار نتيجة المصلحة')} value={pending ?? '—'} hint={L('server count; not a retry queue', 'عدد من الخادم وليس قائمة إعادة')} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card title={L('Submit latency, p95', 'زمن الإرسال p95')} subtitle={L('Milliseconds per day; dashed line is the 2 s alert threshold', 'ملي ثانية يومياً؛ الخط المتقطع حد التنبيه ٢ ث')}>
          <LineChart data={apiDays.map((d) => ({ label: fmtDay(d.date), value: d.p95 }))} format={(n) => `${num(n)} ms`} ariaLabel="p95" threshold={{ value: 2000, label: L('alert 2,000 ms', 'تنبيه ٢٠٠٠') }} />
        </Card>
        <Card title={L('Transport errors per day', 'أخطاء الاتصال يومياً')} subtitle={L('5xx, timeouts and 429 rate limits', 'أخطاء الخادم والمهلة وحدود المعدل')}>
          <BarChart data={apiDays.map((d) => ({ label: fmtDay(d.date), value: d.errors }))} format={(n) => num(n)} ariaLabel={L('Errors per day', 'الأخطاء يومياً')} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={L('Why documents come back Invalid', 'أسباب رفض المستندات')} subtitle={L('Share of invalid documents by first failing validator, 30 days', 'نسبة المستندات غير الصالحة حسب أول مدقق فاشل')} pad={false}>
          <Table>
            <thead><tr><Th>{L('Error', 'الخطأ')}</Th><Th>{L('Validator', 'المدقق')}</Th><Th align="end">{L('Share', 'النسبة')}</Th></tr></thead>
            <tbody>{errorCodes.map((e) => <tr key={e.code}><Td><Mono>{e.code}</Mono></Td><Td className="text-ink-muted">{e.validator}</Td><Td align="end"><span className="inline-flex items-center gap-2"><span className="h-1.5 rounded-full bg-accent" style={{ width: e.share * 1.6 }} />{e.share}%</span></Td></tr>)}</tbody>
          </Table>
        </Card>
        <Card title={L('Endpoint catalogue', 'دليل الواجهات')} subtitle={L('Availability is not live-probed.', 'التوفر غير مفحوص مباشرة.')} pad={false}>
          <Table>
            <thead><tr><Th>{L('Operation', 'العملية')}</Th><Th>{L('Status', 'الحالة')}</Th></tr></thead>
            <tbody>{ENDPOINTS.map((e) => <tr key={e.op}><Td><div>{e.op}</div><Mono className="text-ink-subtle text-[11.5px]">{e.method} {e.path}</Mono></Td><Td><Badge tone="neutral">{L('Not checked', 'غير مفحوص')}</Badge></Td></tr>)}</tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
