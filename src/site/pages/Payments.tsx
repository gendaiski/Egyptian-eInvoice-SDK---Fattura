import { Info, Layers, Repeat, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildInstallments, recurringRuns, type Frequency } from '@/billing/schedules';
import { useI18n } from '@/i18n';
import { Field, Input, LinkButton, Select, Table, Td, Th } from '@/components/ui';
import { CtaBand, PageHero, Section, SectionHead } from '../kit';

export function Payments() {
  const { L, money, date } = useI18n();
  const today = new Date().toISOString().slice(0, 10);
  const [amount, setAmount] = useState(120000);
  const [count, setCount] = useState(6);
  const [down, setDown] = useState(20);
  const [freq, setFreq] = useState<Frequency>('monthly');
  const vatIncl = amount;
  const rows = useMemo(() => buildInstallments(vatIncl, { kind: 'installments', count, frequency: freq, firstDueDate: today, downPaymentPct: down }), [vatIncl, count, freq, down, today]);
  const [rFreq, setRFreq] = useState<Frequency>('monthly');
  const [rEnd, setREnd] = useState(12);
  const runs = useMemo(() => recurringRuns({ kind: 'recurring', frequency: rFreq, interval: 1, startDate: today, end: { type: 'after', count: rEnd }, delivery: 'submit_email', terms: 'net30' }, 12), [rFreq, rEnd, today]);
  const freqOpts = (['weekly', 'monthly', 'quarterly', 'yearly'] as Frequency[]).map((f) => <option key={f} value={f}>{{ weekly: L('Weekly', 'أسبوعياً'), monthly: L('Monthly', 'شهرياً'), quarterly: L('Quarterly', 'ربع سنوي'), yearly: L('Yearly', 'سنوياً') }[f]}</option>);

  return (
    <>
      <PageHero kicker={L('Payments', 'المدفوعات')} title={L('Get paid the way your customers can pay.', 'حصّل بالطريقة التي يستطيع عملاؤك الدفع بها.')}
        lead={L('One payment, recurring schedules, or installments with a down payment. ETA always receives a single valid tax document; the plan lives in Fatura.', 'دفعة واحدة أو جداول متكررة أو أقساط بدفعة مقدمة. المصلحة تستلم مستنداً ضريبياً واحداً والخطة في فاتورة.')}
        actions={<LinkButton to="/app/documents/new" variant="primary" size="lg">{L('Try it in the composer', 'جرّبها في المحرر')}</LinkButton>} />

      <Section>
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-[14px] min-w-[720px]">
            <thead><tr className="text-start">
              <th className="p-5 text-start font-medium text-ink-subtle w-[22%]" />
              {[[<Zap key="z" className="size-4" />, L('One payment', 'دفعة واحدة')], [<Repeat key="r" className="size-4" />, L('Recurring', 'متكررة')], [<Layers key="l" className="size-4" />, L('Installments', 'أقساط')]].map(([icon, t], i) => <th key={i} className="p-5 text-start"><span className="inline-flex items-center gap-2 font-display text-[18px] font-semibold"><span className="text-accent">{icon}</span>{t}</span></th>)}
            </tr></thead>
            <tbody className="divide-y divide-line">
              {[
                [L('What ETA receives', 'ما تستلمه المصلحة'), L('One invoice', 'فاتورة واحدة'), L('A new invoice on each run, dated that day', 'فاتورة جديدة في كل دورة بتاريخ يومها'), L('One invoice for the full amount', 'فاتورة واحدة بالمبلغ كاملاً')],
                [L('When VAT is due', 'استحقاق الضريبة'), L('On issue', 'عند الإصدار'), L('On each run', 'في كل دورة'), L('On issue, for the full amount', 'عند الإصدار عن المبلغ كاملاً')],
                [L('What Fatura tracks', 'ما تتابعه فاتورة'), L('Due date, partial payments, aging', 'الاستحقاق والدفعات الجزئية والأعمار'), L('Schedule, next runs, approval or auto-submit', 'الجدول والدورات القادمة والاعتماد'), L('Down payment, schedule, late installments', 'الدفعة المقدمة والجدول والتأخير')],
                [L('Good for', 'مناسبة لـ'), L('Projects, goods, one-off services', 'المشروعات والسلع والخدمات'), L('Retainers, rent, subscriptions, maintenance', 'العقود والإيجارات والاشتراكات'), L('Equipment, large orders, annual licences', 'المعدات والطلبيات الكبيرة والتراخيص')],
              ].map(([k, ...v]) => <tr key={k}><th className="p-5 text-start font-medium text-ink-muted align-top">{k}</th>{v.map((c, i) => <td key={i} className="p-5 align-top">{c}</td>)}</tr>)}
            </tbody>
          </table>
        </div>
      </Section>

      <Section tone="surface" id="installments">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start">
          <div>
            <SectionHead className="mb-6" title={L('Installment calculator', 'حاسبة الأقساط')} lead={L('The same engine the product uses. Amounts round to the piastre and the remainder lands on the last installment, so the schedule always equals the invoice.', 'نفس محرك المنتج. التقريب للقرش والفرق على القسط الأخير.')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={L('Invoice total incl. VAT (EGP)', 'الإجمالي شاملاً الضريبة')}>{(id) => <Input id={id} type="number" min={0} value={amount} onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))} className="tabular" />}</Field>
              <Field label={L('Installments', 'عدد الأقساط')}>{(id) => <Select id={id} value={count} onChange={(e) => setCount(Number(e.target.value))}>{[2, 3, 4, 6, 9, 12, 18, 24].map((n) => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
              <Field label={L('Down payment %', 'الدفعة المقدمة %')}>{(id) => <Input id={id} type="number" min={0} max={90} value={down} onChange={(e) => setDown(Math.min(90, Math.max(0, Number(e.target.value))))} />}</Field>
              <Field label={L('Frequency', 'الدورية')}>{(id) => <Select id={id} value={freq} onChange={(e) => setFreq(e.target.value as Frequency)}>{freqOpts}</Select>}</Field>
            </div>
            <p className="mt-5 flex gap-2 text-[13.5px] text-ink-muted"><Info className="size-4 text-info shrink-0 mt-0.5" />{L('VAT is due when the invoice is issued, not as installments are collected. Plan your cash flow for it.', 'الضريبة مستحقة عند الإصدار لا عند التحصيل. خطط لتدفقك النقدي.')}</p>
          </div>
          <div className="card overflow-hidden">
            <div className="p-5 border-b border-line flex items-baseline justify-between"><span className="text-ink-muted text-[13px]">{L('Schedule', 'الجدول')}</span><span className="font-display text-[22px] font-semibold tabular">{money(rows.reduce((s, r) => s + r.amount, 0))}</span></div>
            <Table>
              <thead><tr><Th>#</Th><Th>{L('Due', 'الاستحقاق')}</Th><Th align="end">{L('Amount', 'المبلغ')}</Th></tr></thead>
              <tbody>{rows.map((r) => <tr key={r.n}><Td>{r.label === 'down' ? L('Down payment', 'دفعة مقدمة') : r.n}</Td><Td>{date(r.dueDate)}</Td><Td align="end">{money(r.amount)}</Td></tr>)}</tbody>
            </Table>
          </div>
        </div>
      </Section>

      <Section id="recurring">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] items-start">
          <div>
            <SectionHead className="mb-6" title={L('Recurring schedules', 'الجداول المتكررة')} lead={L('Choose what happens on each run: hold as a draft for approval, sign and submit automatically, or submit and email the customer.', 'اختر ما يحدث في كل دورة: مسودة للاعتماد أو إرسال تلقائي أو إرسال مع بريد.')} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={L('Repeat', 'التكرار')}>{(id) => <Select id={id} value={rFreq} onChange={(e) => setRFreq(e.target.value as Frequency)}>{freqOpts}</Select>}</Field>
              <Field label={L('Number of invoices', 'عدد الفواتير')}>{(id) => <Input id={id} type="number" min={1} max={60} value={rEnd} onChange={(e) => setREnd(Math.min(60, Math.max(1, Number(e.target.value))))} />}</Field>
            </div>
            <p className="mt-5 text-[13.5px] text-ink-muted">{L('Unattended submission needs cloud or HSM signing. With a USB token, runs wait as drafts and you are notified.', 'الإرسال دون تدخل يحتاج توقيعاً سحابياً أو HSM. مع التوكن تنتظر الدورات كمسودات.')}</p>
          </div>
          <div className="card p-5">
            <div className="text-[13px] text-ink-muted mb-3">{L('Upcoming invoice dates', 'تواريخ الفواتير القادمة')}</div>
            <ol className="grid sm:grid-cols-2 gap-2">{runs.map((r, i) => <li key={r} className="flex items-center gap-3 rounded-control border border-line px-3 py-2.5 text-[14px]"><span className="font-display text-[12px] text-ink-subtle tabular w-5">{i + 1}</span>{date(r, 'long')}</li>)}</ol>
          </div>
        </div>
      </Section>
      <CtaBand title={L('Set up your first installment plan in minutes.', 'أنشئ أول خطة تقسيط في دقائق.')} primary={{ to: '/signup', label: L('Start free trial', 'ابدأ التجربة') }} secondary={{ to: '/app/receivables', label: L('See the demo tracker', 'اعرض المتابعة في العرض') }} />
    </>
  );
}
