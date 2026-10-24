import { Activity, Database, FileCheck2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, Badge, Button, Callout, PageHeader, Stat } from '@/components/ui';
import { useI18n } from '@/i18n';
import { api } from '@/lib/api';
import { useStore } from '@/store/store';

interface Status {
  at: string; database: 'postgres' | 'pglite'; persistentDatabase: boolean;
  counts: { tenants: number; documents: number; submitted: number };
  queues: { webhooks: number; signing: number };
  lastWorkerTick: string | null; productionSubmissionEnabled: boolean;
  etaLiveVerified: boolean; paymentProviderConfigured: boolean; paymentSimulatorEnabled: boolean;
}

export function Operations() {
  const { mode } = useStore();
  const { L, date } = useI18n();
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    if (mode !== 'api') return;
    setLoading(true);
    try { setStatus(await api<Status>('GET', '/operations/status')); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };
  useEffect(() => { void refresh(); }, [mode]);
  return (
    <div className="animate-in">
      <PageHeader title={L('Beta operations', 'تشغيل النسخة التجريبية')} description={L('Live server checks and release gates for the Fattura Beta. Values are read from the backend, not the dashboard sample data.', 'فحوص الخادم الفعلية ومتطلبات إطلاق النسخة التجريبية.')}
        actions={<Button icon={<RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />} onClick={() => void refresh()} disabled={loading || mode !== 'api'}>{L('Refresh checks', 'تحديث الفحوص')}</Button>} />
      {mode !== 'api' && <Callout tone="warn" title={L('Preview only', 'معاينة فقط')} icon={<ShieldAlert className="size-4" />}>{L('Start the full-stack server to use operations. This static preview cannot inspect or control a server.', 'شغّل الخادم الكامل لاستخدام لوحة التشغيل. هذه المعاينة لا تتحكم بالخادم.')}</Callout>}
      {error && <Callout tone="bad" title={L('Server check failed', 'فشل فحص الخادم')} icon={<ShieldAlert className="size-4" />}>{error}</Callout>}
      {status && <>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <Stat label={L('Tenants', 'الشركات')} value={status.counts.tenants} icon={<Database className="size-4" />} />
          <Stat label={L('Documents', 'المستندات')} value={status.counts.documents} icon={<FileCheck2 className="size-4" />} />
          <Stat label={L('Awaiting ETA result', 'بانتظار نتيجة المصلحة')} value={status.counts.submitted} icon={<Activity className="size-4" />} />
          <Stat label={L('Queued webhooks / signing', 'الربط / التوقيع المعلق')} value={`${status.queues.webhooks} / ${status.queues.signing}`} />
        </div>
        <div className="grid lg:grid-cols-2 gap-4">
          <Card title={L('Server and storage', 'الخادم والتخزين')}>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between gap-3"><span>{L('Database', 'قاعدة البيانات')}</span><Badge tone={status.persistentDatabase ? 'ok' : 'warn'}>{status.database} · {status.persistentDatabase ? L('persistent', 'دائمة') : L('temporary', 'مؤقتة')}</Badge></div>
              <div className="flex justify-between gap-3"><span>{L('Last worker cycle', 'آخر دورة للمعالج')}</span><span>{status.lastWorkerTick ? date(status.lastWorkerTick, 'datetime') : L('Never recorded', 'لم تسجل')}</span></div>
              <div className="flex justify-between gap-3"><span>{L('Checked at', 'وقت الفحص')}</span><span>{date(status.at, 'datetime')}</span></div>
            </div>
          </Card>
          <Card title={L('Integration gates', 'متطلبات الربط')}>
            <div className="space-y-3 text-[14px]">
              <div className="flex justify-between gap-3"><span>{L('ETA production submission', 'إرسال المصلحة الفعلي')}</span><Badge tone={status.productionSubmissionEnabled ? 'warn' : 'neutral'}>{status.productionSubmissionEnabled ? L('Enabled by operator', 'مفعل') : L('Blocked', 'محظور')}</Badge></div>
              <div className="flex justify-between gap-3"><span>{L('Live ETA acceptance test', 'اختبار المصلحة الفعلي')}</span><Badge tone="warn">{L('Not verified', 'غير متحقق')}</Badge></div>
              <div className="flex justify-between gap-3"><span>{L('Payment provider', 'مزود الدفع')}</span><Badge tone="warn">{L('Not connected', 'غير مربوط')}</Badge></div>
              <div className="flex justify-between gap-3"><span>{L('Payment test simulator', 'محاكي الدفع')}</span><Badge tone={status.paymentSimulatorEnabled ? 'ok' : 'neutral'}>{status.paymentSimulatorEnabled ? L('Enabled', 'مفعل') : L('Disabled', 'معطل')}</Badge></div>
            </div>
          </Card>
        </div>
        <Card className="mt-4" title={L('Server controls', 'التحكم بالخادم')}>
          <p className="text-[13px] text-ink-muted mb-4">{L('Use ETA health to retry simulator documents. Billing records require a payment reference. Live ETA and payment collection need external accounts and separate acceptance tests.', 'استخدم صفحة المصلحة لإعادة محاولة مستندات المحاكي. تسجيل التحصيل يتطلب مرجع دفع. الربط الفعلي يحتاج حسابات واختبارات منفصلة.')}</p>
          <div className="flex flex-wrap gap-2"><Link className="inline-flex items-center h-9 px-3 rounded-md border border-line text-[13px] hover:bg-sunken" to="/admin/eta">{L('ETA queue', 'قائمة المصلحة')}</Link><Link className="inline-flex items-center h-9 px-3 rounded-md border border-line text-[13px] hover:bg-sunken" to="/admin/billing">{L('Billing', 'التحصيل')}</Link><Link className="inline-flex items-center h-9 px-3 rounded-md border border-line text-[13px] hover:bg-sunken" to="/admin/audit">{L('Audit export', 'تصدير التدقيق')}</Link></div>
        </Card>
      </>}
      {mode === 'api' && !status && !error && <p className="text-ink-muted">{L('Checking server…', 'جار فحص الخادم…')}</p>}
      <p className="sr-only" aria-live="polite">{loading ? L('Checking server', 'جار فحص الخادم') : status ? L('Server check complete', 'اكتمل فحص الخادم') : ''}</p>
    </div>
  );
}
