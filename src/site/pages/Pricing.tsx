import { Check, Minus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { priceFor, type Billing } from '@/billing/plans';
import { bi, useI18n } from '@/i18n';
import type { Plan } from '@/store/model';
import { useStore } from '@/store/store';
import { Segmented, btnClass, cx } from '@/components/ui';
import { CtaBand, Faq, PageHero, Section, SectionHead } from '../kit';


export function Pricing() {
  const { db } = useStore();
  const { L, lang, money, num } = useI18n();
  const plans = db.admin.plans.filter((p) => p.active);
  const [billing, setBilling] = useState<Billing>('yearly');
  const [docs, setDocs] = useState(400);
  const recommended = useMemo(() => plans.find((p) => p.docsPerMonth >= docs) ?? plans[plans.length - 1], [plans, docs]);
  const steps = [50, 100, 150, 250, 400, 600, 1000, 1500, 3000, 6000, 10000, 20000];
  const idx = steps.findIndex((s) => s >= docs);

  const rows: [string, (p: Plan) => boolean | string][] = [
    [L('Documents per month', 'مستندات شهرياً'), (p) => num(p.docsPerMonth)],
    [L('Users', 'المستخدمون'), (p) => String(p.users)],
    [L('Branches', 'الفروع'), (p) => String(p.branches)],
    [L('Invoices, credit & debit notes, export', 'فواتير وإشعارات وتصدير'), () => true],
    [L('Pre-flight validation & bilingual PDF', 'الفحص المسبق وPDF ثنائي اللغة'), () => true],
    [L('Recurring & installment plans', 'الفواتير المتكررة والأقساط'), () => true],
    [L('Received-documents inbox', 'صندوق المستندات الواردة'), (p) => p.id !== 'starter'],
    [L('Bulk submit & CSV import', 'إرسال جماعي واستيراد CSV'), (p) => p.id !== 'starter'],
    [L('E-receipts (POS)', 'الإيصالات الإلكترونية'), (p) => p.id === 'scale'],
    [L('HSM / cloud signing', 'توقيع سحابي / HSM'), (p) => p.id === 'scale'],
    [L('REST API & webhooks', 'واجهة برمجة وWebhooks'), (p) => p.id === 'scale'],
  ];

  return (
    <>
      <PageHero title={L('Pricing that fits your cash flow.', 'أسعار تناسب تدفقك النقدي.')} lead={L('Every plan can be paid monthly, yearly, as a yearly licence in interest-free installments, or once. Prices exclude 14% VAT and are invoiced as valid ETA invoices.', 'كل باقة تُدفع شهرياً أو سنوياً أو بالتقسيط دون فوائد أو مرة واحدة. الأسعار لا تشمل ضريبة ١٤٪.')} />
      <Section className="pt-10 sm:pt-14">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-8">
          <div className="w-full max-w-[460px]">
            <label htmlFor="docs" className="label">{L('Documents you issue per month', 'المستندات التي تصدرها شهرياً')}</label>
            <div className="flex items-center gap-4">
              <input id="docs" type="range" min={0} max={steps.length - 1} value={Math.max(0, idx)} onChange={(e) => setDocs(steps[Number(e.target.value)])} className="flex-1 accent-[rgb(var(--accent))]" />
              <span className="font-display text-[22px] font-semibold tabular w-24 text-end">{num(docs)}</span>
            </div>
            <p className="text-[13px] text-ink-muted mt-1">{L('Recommended:', 'المقترح:')} <span className="font-semibold text-accent">{bi(lang, { en: recommended.name, ar: recommended.nameAr })}</span></p>
          </div>
          <Segmented value={billing} onChange={setBilling} options={[{ value: 'monthly', label: L('Monthly', 'شهري') }, { value: 'yearly', label: L('Yearly', 'سنوي') }, { value: 'installments', label: L('Installments', 'تقسيط') }, { value: 'one-time', label: L('One-time', 'مرة واحدة') }]} />
        </div>
        <div className={cx('grid gap-4', plans.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
          {plans.map((p) => {
            const [price, en, ar] = priceFor(p, billing);
            const rec = p.id === recommended.id;
            return (
              <div key={p.id} className={cx('card flex flex-col overflow-hidden transition-shadow', rec && 'ring-2 ring-accent border-accent shadow-pop')}>
                <div className={cx('px-6 py-4 border-b border-line', rec ? 'bg-accent text-accent-on' : 'bg-sunken/60')}>
                  <div className="flex items-center justify-between gap-2"><span className="font-display font-semibold text-[18px]">{bi(lang, { en: p.name, ar: p.nameAr })}</span>{rec && <span className="text-[12px] font-medium">{L('Fits your volume', 'يناسب حجمك')}</span>}</div>
                  <p className={cx('text-[13px] mt-0.5', rec ? 'opacity-85' : 'text-ink-muted')}>{bi(lang, p.blurb)}</p>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-baseline gap-1.5 flex-wrap"><span className="font-display text-[34px] font-semibold tabular tracking-[-0.02em]">{money(price).replace(/\.00(?=\D*$)/, '')}</span><span className="text-ink-muted">{L(en, ar)}</span></div>
                  <p className="text-[12.5px] text-ink-subtle mt-1 min-h-[18px]">
                    {billing === 'yearly' && L(`Two months free vs monthly`, 'شهران مجاناً مقارنة بالشهري')}
                    {billing === 'installments' && L(`Yearly licence, ${money(p.installments.amount * p.installments.count)} total, interest-free`, `ترخيص سنوي بإجمالي ${money(p.installments.amount * p.installments.count)} دون فوائد`)}
                    {billing === 'one-time' && L('Lifetime licence + 12 months of updates', 'ترخيص دائم + ١٢ شهراً تحديثات')}
                  </p>
                  <ul className="mt-5 space-y-2 text-[14px] flex-1">
                    <li className="flex gap-2"><Check className="size-4 text-ok mt-0.5 shrink-0" />{L(`${num(p.docsPerMonth)} documents / month`, `${num(p.docsPerMonth)} مستند / شهر`)}</li>
                    {p.features.map((f) => <li key={f.en} className="flex gap-2"><Check className="size-4 text-ok mt-0.5 shrink-0" />{bi(lang, f)}</li>)}
                  </ul>
                  <Link to={`/signup?plan=${p.id}&billing=${billing}`} className={btnClass(rec ? 'primary' : 'secondary', 'lg', 'mt-6 w-full')}>{L(`Start with ${p.name}`, `ابدأ بـ${p.nameAr}`)}</Link>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[13px] text-ink-muted">{L('Need more than 20,000 documents a month, or many client companies?', 'تحتاج أكثر من ٢٠٬٠٠٠ مستند شهرياً أو شركات متعددة؟')} <Link className="link font-medium" to={`/contact?topic=sales&plan=${recommended.id}&billing=${billing}&docs=${docs}`}>{L('Talk to sales', 'تحدث للمبيعات')}</Link></p>
      </Section>

      <Section tone="surface">
        <SectionHead title={L('Compare plans', 'قارن الباقات')} />
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[640px] text-[14px]">
            <thead><tr className="border-b border-line"><th className="p-4 text-start" />{plans.map((p) => <th key={p.id} className={cx('p-4 text-start font-display text-[16px]', p.id === recommended.id && 'bg-accent-soft/60 text-accent')}>{bi(lang, { en: p.name, ar: p.nameAr })}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">
              {rows.map(([k, f]) => (
                <tr key={k}><th className="p-4 text-start font-normal text-ink-muted">{k}</th>
                  {plans.map((p) => { const v = f(p); return <td key={p.id} className={cx('p-4', p.id === recommended.id && 'bg-accent-soft/40')}>{v === true ? <Check className="size-5 text-ok" aria-label={L('Included', 'متضمن')} /> : v === false ? <Minus className="size-5 text-ink-subtle" aria-label={L('Not included', 'غير متضمن')} /> : <span className="tabular font-medium">{v}</span>}</td>; })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <SectionHead className="mb-0" title={L('Billing questions', 'أسئلة الفوترة')} />
          <Faq items={[
            [L('How do installments work for my Fatura plan?', 'كيف يعمل تقسيط باقة فاتورة؟'), L('You buy a yearly licence and pay it in equal monthly installments with no interest. Each installment is invoiced as a valid ETA invoice.', 'تشتري ترخيصاً سنوياً وتدفعه على أقساط شهرية متساوية دون فوائد، وكل قسط بفاتورة إلكترونية صالحة.')],
            [L('What does the one-time licence include?', 'ماذا يشمل الترخيص الدائم؟'), L('Permanent use of your plan plus 12 months of updates, including ETA schema changes. After that, updates renew yearly at 20% of the licence price.', 'استخدام دائم للباقة و١٢ شهراً من التحديثات، ثم تجديد سنوي للتحديثات بنسبة ٢٠٪.')],
            [L('Can I switch billing models later?', 'هل يمكنني تغيير نموذج الدفع لاحقاً؟'), L('Yes. Changes apply from your next cycle. Moving to a one-time licence credits what you paid in the current year.', 'نعم، من الدورة التالية. الانتقال للترخيص الدائم يحتسب ما دفعته هذا العام.')],
            [L('What happens if I go over my document limit?', 'ماذا لو تجاوزت حد المستندات؟'), L('Nothing stops. We tell you at 80% and 100%, and suggest the next plan if it keeps happening.', 'لا يتوقف شيء. ننبهك عند ٨٠٪ و١٠٠٪ ونقترح الباقة الأعلى إن تكرر.')],
          ]} />
        </div>
      </Section>
      <CtaBand title={L('Start free on pre-production.', 'ابدأ مجاناً على بيئة الاختبار.')} lead={L('14 days, no card. Pick your billing model when you go live.', '١٤ يوماً دون بطاقة. اختر طريقة الدفع عند التشغيل.')} primary={{ to: `/signup?plan=${recommended.id}&billing=${billing}`, label: L('Start free trial', 'ابدأ التجربة') }} secondary={{ to: '/contact?topic=sales', label: L('Talk to sales', 'تحدث للمبيعات') }} />
    </>
  );
}
