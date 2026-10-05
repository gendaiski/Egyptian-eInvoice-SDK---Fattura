import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { ENDPOINTS } from '@/eta/client';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { BarChart, LineChart } from '@/components/charts';
import { Badge, Button, Callout, Card, Mono, PageHeader, Stat, Table, Td, Th, useToast } from '@/components/ui';

export function EtaHealth() {
  const { db } = useStore();
  const { L, num, lang } = useI18n();
  const toast = useToast();
  const [retrying, setRetrying] = useState(false);
  const api = db.admin.api;
  const fmtDay = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(d));
  const total = api.reduce((s, d) => s + d.submitted, 0);
  const errors = api.reduce((s, d) => s + d.errors, 0);
  const incident = api.reduce((a, d) => (d.errors > a.errors ? d : a), api[0]);
  const p95 = [...api].sort((a, b) => a.p95 - b.p95)[Math.floor(api.length * 0.95)]?.p95 ?? 0;
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
      <PageHeader title={L('ETA integration health', 'صحة الربط مع المصلحة')} description={L('Our traffic to the ETA APIs across all tenants: volume, latency, transport errors and why documents come back Invalid.', 'حركتنا مع واجهات المصلحة: الحجم وزمن الاستجابة والأخطاء وأسباب الرفض.')}
        actions={<Button icon={<RefreshCw className={retrying ? 'size-4 animate-spin' : 'size-4'} />} onClick={async () => { setRetrying(true); await new Promise((r) => setTimeout(r, 1000)); setRetrying(false); toast({ tone: 'ok', text: L('Retry queue drained — 0 pending.', 'تم إفراغ قائمة إعادة المحاولة.') }); }}>{L('Drain retry queue', 'إفراغ قائمة الإعادة')}</Button>} />
      <Callout tone="warn" title={L(`Incident on ${fmtDay(incident.date)}: ${incident.errors} transport errors`, `حادث في ${fmtDay(incident.date)}: ${incident.errors} خطأ اتصال`)} icon={<AlertTriangle className="size-[18px]" />}>
        {L('ETA returned 503 for ~40 minutes. Submissions were queued and retried with backoff; no documents were lost.', 'أعادت المصلحة خطأ 503 لنحو ٤٠ دقيقة. حُفظت المستندات وأعيد إرسالها دون فقد.')}
      </Callout>
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 my-5">
        <Stat label={L('Submitted · 30d', 'مُرسلة · ٣٠ يوماً')} value={num(total)} />
        <Stat label={L('Transport success', 'نجاح الاتصال')} value={`${(100 - (errors / total) * 100).toFixed(2)}%`} icon={<CheckCircle2 className="size-4 text-ok" />} />
        <Stat label={L('p95 latency (submit)', 'زمن الاستجابة p95')} value={`${num(p95)} ms`} />
        <Stat label={L('Retry queue', 'قائمة الإعادة')} value={0} hint={L('documents waiting', 'مستند منتظر')} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2 mb-5">
        <Card title={L('Submit latency, p95', 'زمن الإرسال p95')} subtitle={L('Milliseconds per day; dashed line is the 2 s alert threshold', 'ملي ثانية يومياً؛ الخط المتقطع حد التنبيه ٢ ث')}>
          <LineChart data={api.map((d) => ({ label: fmtDay(d.date), value: d.p95 }))} format={(n) => `${num(n)} ms`} ariaLabel="p95" threshold={{ value: 2000, label: L('alert 2,000 ms', 'تنبيه ٢٠٠٠') }} />
        </Card>
        <Card title={L('Transport errors per day', 'أخطاء الاتصال يومياً')} subtitle={L('5xx, timeouts and 429 rate limits', 'أخطاء الخادم والمهلة وحدود المعدل')}>
          <BarChart data={api.map((d) => ({ label: fmtDay(d.date), value: d.errors }))} format={(n) => num(n)} ariaLabel={L('Errors per day', 'الأخطاء يومياً')} />
        </Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={L('Why documents come back Invalid', 'أسباب رفض المستندات')} subtitle={L('Share of invalid documents by first failing validator, 30 days', 'نسبة المستندات غير الصالحة حسب أول مدقق فاشل')} pad={false}>
          <Table>
            <thead><tr><Th>{L('Error', 'الخطأ')}</Th><Th>{L('Validator', 'المدقق')}</Th><Th align="end">{L('Share', 'النسبة')}</Th></tr></thead>
            <tbody>{errorCodes.map((e) => <tr key={e.code}><Td><Mono>{e.code}</Mono></Td><Td className="text-ink-muted">{e.validator}</Td><Td align="end"><span className="inline-flex items-center gap-2"><span className="h-1.5 rounded-full bg-accent" style={{ width: e.share * 1.6 }} />{e.share}%</span></Td></tr>)}</tbody>
          </Table>
        </Card>
        <Card title={L('Endpoint status', 'حالة الواجهات')} pad={false}>
          <Table>
            <thead><tr><Th>{L('Operation', 'العملية')}</Th><Th>{L('Status', 'الحالة')}</Th></tr></thead>
            <tbody>{ENDPOINTS.map((e, i) => <tr key={e.op}><Td><div>{e.op}</div><Mono className="text-ink-subtle text-[11.5px]">{e.method} {e.path}</Mono></Td><Td>{i === 12 ? <Badge tone="warn">{L('Degraded', 'متدهورة')}</Badge> : <Badge tone="ok">{L('Operational', 'تعمل')}</Badge>}</Td></tr>)}</tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
