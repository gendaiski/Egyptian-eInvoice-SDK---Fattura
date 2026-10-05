import { CalendarClock, Layers, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { docTotal, dueInfo, paidAmount, type Doc } from '@/store/model';
import { useActions, useStore } from '@/store/store';
import { Badge, Button, Card, EmptyState, Money, PageHeader, Progress, Segmented, Table, Td, Th, cx, useToast } from '@/components/ui';
import { PaymentDialog } from './DocumentDetail';
import { DueBadge, useLabels } from './shared';

export function Receivables() {
  const { db } = useStore();
  const actions = useActions();
  const { L, date, money } = useI18n();
  const lb = useLabels();
  const toast = useToast();
  const [view, setView] = useState<'open' | 'installments' | 'payments'>('open');
  const [pay, setPay] = useState<Doc | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const open = useMemo(() => db.docs.map((d) => ({ d, i: dueInfo(d, today) })).filter((x) => x.i.outstanding > 0).sort((a, b) => (a.i.dueDate ?? '').localeCompare(b.i.dueDate ?? '')), [db.docs, today]);
  const buckets = useMemo(() => {
    const b = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    for (const { i } of open) {
      const late = i.dueDate ? (Date.now() - new Date(i.dueDate).getTime()) / 86_400_000 : 0;
      if (late <= 0) b.current += i.outstanding; else if (late <= 30) b.d30 += i.outstanding; else if (late <= 60) b.d60 += i.outstanding; else if (late <= 90) b.d90 += i.outstanding; else b.older += i.outstanding;
    }
    return b;
  }, [open]);
  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  const plans = db.docs.filter((d) => d.installments?.length && d.status === 'Valid');
  const payments = db.docs.flatMap((d) => d.payments.map((p) => ({ p, d }))).sort((a, b) => b.p.date.localeCompare(a.p.date)).slice(0, 60);

  return (
    <div className="animate-in">
      <PageHeader title={L('Payments & installments', 'المدفوعات والأقساط')} description={L('What customers owe you, when it is due, and how installment plans are tracking.', 'المستحق على العملاء ومواعيده ومتابعة خطط التقسيط.')} />
      <Card className="mb-5" title={L('Aged receivables', 'أعمار الديون')} subtitle={L(`${money(total)} outstanding across ${open.length} invoices`, `${money(total)} مستحقة على ${open.length} فاتورة`)}>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {([['current', L('Not yet due', 'لم تستحق'), 'ok'], ['d30', L('1–30 days late', '١–٣٠ يوم تأخير'), 'warn'], ['d60', L('31–60 days', '٣١–٦٠ يوم'), 'warn'], ['d90', L('61–90 days', '٦١–٩٠ يوم'), 'bad'], ['older', L('90+ days', '+٩٠ يوم'), 'bad']] as const).map(([k, label, tone]) => (
            <div key={k} className="rounded-md border border-line p-3">
              <div className="text-[12px] text-ink-muted">{label}</div>
              <div className="text-[18px] font-semibold tabular mt-1">{money(buckets[k], 'EGP', { compact: true })}</div>
              <Progress className="mt-2" value={total ? buckets[k] / total : 0} tone={tone} />
            </div>
          ))}
        </div>
      </Card>

      <Segmented className="mb-4" value={view} onChange={setView} options={[
        { value: 'open', label: L('Open invoices', 'فواتير مفتوحة'), icon: <CalendarClock className="size-4" /> },
        { value: 'installments', label: L('Installment plans', 'خطط التقسيط'), icon: <Layers className="size-4" /> },
        { value: 'payments', label: L('Payments received', 'المدفوعات المستلمة'), icon: <Wallet className="size-4" /> },
      ]} />

      {view === 'open' && (
        <Card pad={false}>
          {open.length === 0 ? <EmptyState icon={<Wallet className="size-5" />} title={L('Everything is paid', 'كل شيء مدفوع')} /> : (
            <Table>
              <thead><tr><Th>{L('Invoice', 'الفاتورة')}</Th><Th>{L('Customer', 'العميل')}</Th><Th>{L('Due', 'الاستحقاق')}</Th><Th align="end">{L('Outstanding', 'المتبقي')}</Th><Th /></tr></thead>
              <tbody>{open.map(({ d, i }) => (
                <tr key={d.id} className="hover:bg-sunken/50">
                  <Td><Link to={`/app/documents/${d.id}`} className="font-medium text-ink hover:text-accent">{d.internalID}</Link>{d.installments && <div className="text-[12px] text-ink-subtle">{L('Installment plan', 'خطة تقسيط')}</div>}</Td>
                  <Td className="max-w-[240px] truncate">{d.counterparty.name}</Td>
                  <Td><DueBadge doc={d} /></Td>
                  <Td align="end"><Money value={i.outstanding} className={cx('font-medium', i.state === 'overdue' && 'text-bad')} /></Td>
                  <Td align="end"><Button size="sm" onClick={() => setPay(d)}>{L('Record payment', 'تسجيل دفعة')}</Button></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </Card>
      )}

      {view === 'installments' && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {plans.length === 0 && <Card className="md:col-span-2 xl:col-span-3"><EmptyState icon={<Layers className="size-5" />} title={L('No installment plans', 'لا توجد خطط تقسيط')} body={L('Choose “Installments” when creating an invoice.', 'اختر "أقساط" عند إنشاء فاتورة.')} /></Card>}
          {plans.map((d) => {
            const t = docTotal(d), paid = paidAmount(d);
            const done = d.installments!.filter((r) => r.paid >= r.amount - 0.005).length;
            const late = d.installments!.filter((r) => r.paid < r.amount - 0.005 && r.dueDate < today).length;
            return (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><Link to={`/app/documents/${d.id}`} className="font-semibold text-ink hover:text-accent">{d.counterparty.name}</Link><div className="text-[12.5px] text-ink-subtle">{d.internalID} · {money(t)}</div></div>
                  {late ? <Badge tone="bad">{L(`${late} late`, `${late} متأخر`)}</Badge> : done === d.installments!.length ? <Badge tone="ok">{L('Complete', 'مكتمل')}</Badge> : <Badge tone="info">{L('On track', 'منتظم')}</Badge>}
                </div>
                <div className="flex gap-1 mt-4" aria-label={L(`${done} of ${d.installments!.length} paid`, `${done} من ${d.installments!.length} مدفوعة`)}>
                  {d.installments!.map((r) => <span key={r.n} title={`${date(r.dueDate)} · ${money(r.amount)}`} className={cx('h-2 flex-1 rounded-full', r.paid >= r.amount - 0.005 ? 'bg-ok' : r.dueDate < today ? 'bg-bad' : 'bg-sunken border border-line')} />)}
                </div>
                <div className="flex justify-between mt-2 text-[12.5px] text-ink-muted"><span>{L(`${done} of ${d.installments!.length} paid`, `${done} من ${d.installments!.length} مدفوعة`)}</span><span className="tabular">{money(paid)}</span></div>
                {d.installments!.find((r) => r.paid < r.amount - 0.005) && (
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between gap-2">
                    <span className="text-[13px]">{L('Next', 'التالي')}: <span className="font-medium">{date(d.installments!.find((r) => r.paid < r.amount - 0.005)!.dueDate)}</span></span>
                    <Button size="sm" onClick={() => setPay(d)}>{L('Record', 'تسجيل')}</Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {view === 'payments' && (
        <Card pad={false}>
          <Table>
            <thead><tr><Th>{L('Date', 'التاريخ')}</Th><Th>{L('Invoice', 'الفاتورة')}</Th><Th>{L('Customer', 'العميل')}</Th><Th>{L('Method', 'الطريقة')}</Th><Th align="end">{L('Amount', 'المبلغ')}</Th></tr></thead>
            <tbody>{payments.map(({ p, d }) => (
              <tr key={p.id + d.id}><Td className="text-ink-muted whitespace-nowrap">{date(p.date)}</Td><Td><Link to={`/app/documents/${d.id}`} className="text-ink hover:text-accent">{d.internalID}</Link>{p.note && <div className="text-[12px] text-ink-subtle">{p.note}</div>}</Td><Td className="max-w-[220px] truncate">{d.counterparty.name}</Td><Td>{lb.method(p.method)}</Td><Td align="end"><Money value={p.amount} /></Td></tr>
            ))}</tbody>
          </Table>
        </Card>
      )}

      {pay && <PaymentDialog open doc={pay} onClose={() => setPay(null)} onSave={(p) => { actions.recordPayment(pay.id, p); setPay(null); toast({ tone: 'ok', text: L('Payment recorded.', 'تم تسجيل الدفعة.') }); }} />}
    </div>
  );
}
