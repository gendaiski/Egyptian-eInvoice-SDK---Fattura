import { ArrowLeft, CalendarRange, Pause, Play, Plus, Repeat, Zap } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { recurringRuns } from '@/billing/schedules';
import { useI18n } from '@/i18n';
import { computeDoc, docTotal } from '@/store/model';
import { useActions, useStore } from '@/store/store';
import { Badge, Button, Card, DescList, EmptyState, LinkButton, Money, PageHeader, StatusBadge, Table, Td, Th, useToast } from '@/components/ui';
import { NotFound } from '../NotFound';
import { useLabels } from './shared';

export function RecurringList() {
  const { db } = useStore();
  const { L, date } = useI18n();
  const lb = useLabels();
  const nav = useNavigate();
  const active = db.recurring.filter((r) => r.status === 'active');
  const monthly = active.reduce((s, r) => {
    const amt = computeDoc({ lines: r.lines, extraDiscount: 0 }).totals.totalAmount;
    const per = { weekly: 52 / 12, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 }[r.plan.frequency] / r.plan.interval;
    return s + amt * per;
  }, 0);
  return (
    <div className="animate-in">
      <PageHeader title={L('Recurring invoices', 'الفواتير المتكررة')}
        description={L('Schedules that issue a fresh ETA invoice on each run — retainers, subscriptions, rent, maintenance.', 'جداول تُصدر فاتورة جديدة في كل دورة — عقود دعم واشتراكات وإيجارات.')}
        actions={<LinkButton to="/app/documents/new" variant="primary" icon={<Plus className="size-4" />}>{L('New recurring invoice', 'فاتورة متكررة جديدة')}</LinkButton>} />
      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Active schedules', 'جداول نشطة')}</div><div className="text-[24px] font-semibold tabular mt-1">{active.length}</div></div>
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Recurring revenue / month', 'الإيراد المتكرر شهرياً')}</div><div className="text-[24px] font-semibold tabular mt-1"><Money value={monthly} compact /></div></div>
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Next run', 'الإصدار القادم')}</div><div className="text-[24px] font-semibold mt-1">{date(active.map((r) => r.nextRun).filter(Boolean).sort()[0])}</div></div>
      </div>
      <Card pad={false}>
        {db.recurring.length === 0 ? <EmptyState icon={<Repeat className="size-5" />} title={L('No recurring invoices', 'لا توجد فواتير متكررة')} body={L('Choose “Recurring” under “How will the customer pay?” when creating an invoice.', 'اختر "متكررة" عند إنشاء فاتورة.')} /> : (
          <Table>
            <thead><tr><Th>{L('Schedule', 'الجدول')}</Th><Th>{L('Frequency', 'التكرار')}</Th><Th>{L('On each run', 'في كل دورة')}</Th><Th>{L('Next run', 'القادم')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('Amount', 'المبلغ')}</Th></tr></thead>
            <tbody>
              {db.recurring.map((r) => (
                <tr key={r.id} className="hover:bg-sunken/50 cursor-pointer" onClick={() => nav(`/app/recurring/${r.id}`)}>
                  <Td><Link to={`/app/recurring/${r.id}`} className="font-medium text-ink hover:text-accent">{r.name}</Link><div className="text-[12px] text-ink-subtle">{L(`${r.generatedIds.length} issued`, `${r.generatedIds.length} صادرة`)}</div></Td>
                  <Td>{lb.freq(r.plan.frequency, r.plan.interval)}</Td>
                  <Td className="text-ink-muted text-[13px]">{{ draft: L('Draft for approval', 'مسودة للاعتماد'), submit: L('Auto-submit', 'إرسال تلقائي'), submit_email: L('Auto-submit + email', 'إرسال تلقائي + بريد') }[r.plan.delivery]}</Td>
                  <Td>{r.status === 'active' ? date(r.nextRun) : '—'}</Td>
                  <Td>{r.status === 'active' ? <Badge tone="ok">{L('Active', 'نشط')}</Badge> : r.status === 'paused' ? <Badge tone="warn">{L('Paused', 'متوقف')}</Badge> : <Badge>{L('Ended', 'منتهٍ')}</Badge>}</Td>
                  <Td align="end"><Money value={computeDoc({ lines: r.lines, extraDiscount: 0 }).totals.totalAmount} className="font-medium" /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}

export function RecurringDetail() {
  const { id } = useParams();
  const { db } = useStore();
  const actions = useActions();
  const { L, date } = useI18n();
  const lb = useLabels();
  const toast = useToast();
  const nav = useNavigate();
  const r = db.recurring.find((x) => x.id === id);
  if (!r) return <NotFound />;
  const c = db.customers.find((x) => x.id === r.customerId);
  const generated = db.docs.filter((d) => r.generatedIds.includes(d.id));
  const upcoming = r.status === 'active' ? recurringRuns(r.plan, 6, r.nextRun) : [];
  const amount = computeDoc({ lines: r.lines, extraDiscount: 0 }).totals.totalAmount;
  return (
    <div className="animate-in">
      <PageHeader
        back={<Link to="/app/recurring" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink mb-2"><ArrowLeft className="size-4 rtl:rotate-180" />{L('Recurring invoices', 'الفواتير المتكررة')}</Link>}
        title={r.name}
        description={`${c?.name ?? ''} · ${lb.freq(r.plan.frequency, r.plan.interval)}`}
        actions={<>
          {r.status === 'active'
            ? <Button icon={<Pause className="size-4" />} onClick={() => { actions.setRecurringStatus(r.id, 'paused'); toast({ tone: 'ok', text: L('Schedule paused.', 'تم إيقاف الجدول.') }); }}>{L('Pause', 'إيقاف')}</Button>
            : <Button icon={<Play className="size-4" />} onClick={() => { actions.setRecurringStatus(r.id, 'active'); toast({ tone: 'ok', text: L('Schedule resumed.', 'تم استئناف الجدول.') }); }}>{L('Resume', 'استئناف')}</Button>}
          <Button variant="primary" icon={<Zap className="size-4" />} onClick={async () => { const nid = await actions.runRecurringNow(r.id); if (!nid) return; toast({ tone: 'ok', text: L('Invoice generated as a draft for review.', 'تم إنشاء الفاتورة كمسودة للمراجعة.') }); nav(`/app/documents/${nid}`); }}>{L('Issue one now', 'إصدار واحدة الآن')}</Button>
        </>} />
      <div className="grid gap-5 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-5">
          <Card title={L('Invoices issued by this schedule', 'الفواتير الصادرة من هذا الجدول')} pad={false}>
            {generated.length === 0 ? <EmptyState icon={<Repeat className="size-5" />} title={L('Nothing issued yet', 'لم يصدر شيء بعد')} body={L(`First run on ${date(r.nextRun)}.`, `أول إصدار في ${date(r.nextRun)}.`)} /> : (
              <Table>
                <thead><tr><Th>{L('Number', 'الرقم')}</Th><Th>{L('Issued', 'الإصدار')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('Total', 'الإجمالي')}</Th></tr></thead>
                <tbody>{[...generated].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map((d) => (
                  <tr key={d.id} className="hover:bg-sunken/50"><Td><Link to={`/app/documents/${d.id}`} className="font-medium text-ink hover:text-accent">{d.internalID}</Link></Td><Td className="text-ink-muted">{date(d.issuedAt)}</Td><Td><StatusBadge status={d.status} /></Td><Td align="end"><Money value={docTotal(d)} /></Td></tr>
                ))}</tbody>
              </Table>
            )}
          </Card>
        </div>
        <div className="space-y-5">
          <Card title={L('Schedule', 'الجدول')}>
            <DescList cols={1} items={[
              { k: L('Amount per invoice', 'المبلغ لكل فاتورة'), v: <Money value={amount} className="font-semibold" /> },
              { k: L('Repeats', 'التكرار'), v: lb.freq(r.plan.frequency, r.plan.interval) },
              { k: L('Ends', 'ينتهي'), v: r.plan.end.type === 'never' ? L('Never', 'أبداً') : r.plan.end.type === 'after' ? L(`After ${r.plan.end.count} invoices`, `بعد ${r.plan.end.count} فاتورة`) : date(r.plan.end.date) },
              { k: L('Payment terms', 'شروط الدفع'), v: lb.terms(r.plan.terms) },
              { k: L('On each run', 'في كل دورة'), v: { draft: L('Save as draft for approval', 'حفظ كمسودة للاعتماد'), submit: L('Sign & submit automatically', 'توقيع وإرسال تلقائي'), submit_email: L('Submit and email the customer', 'إرسال وبريد للعميل') }[r.plan.delivery] },
            ]} />
          </Card>
          <Card title={L('Upcoming runs', 'الإصدارات القادمة')}>
            {upcoming.length ? <ul className="space-y-2">{upcoming.map((d) => <li key={d} className="flex items-center gap-2.5 text-[13.5px]"><CalendarRange className="size-4 text-accent" />{date(d, 'long')}</li>)}</ul> : <p className="text-ink-muted">{r.status === 'paused' ? L('Paused — resume to schedule runs.', 'متوقف — استأنف لجدولة الإصدارات.') : L('No more runs.', 'لا توجد إصدارات أخرى.')}</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}
