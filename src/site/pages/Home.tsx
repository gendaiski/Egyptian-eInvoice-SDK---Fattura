import { ArrowRight, CalendarRange, CheckCircle2, FileInput, KeyRound, Layers, Repeat, Usb, XCircle, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { buildInstallments, recurringRuns } from '@/billing/schedules';
import { ACTIVITY_CODES, TAX_TYPES, UNIT_TYPES } from '@/eta/codes';
import { VALIDATORS } from '@/eta/mockClient';
import { bi, useI18n } from '@/i18n';
import { docTotal } from '@/store/model';
import { useStore } from '@/store/store';
import { InvoicePaper } from '@/components/InvoicePaper';
import { Stamp } from '@/components/Stamp';
import { LinkButton, Segmented, cx } from '@/components/ui';
import { ArrowLink, CtaBand, EchoLine, Faq, Section, SectionHead, Wrap } from '../kit';

export function Home() {
  const { db } = useStore();
  const { L, lang, money, date } = useI18n();
  const sample = db.docs.find((d) => d.direction === 'sent' && d.status === 'Valid' && d.documentType === 'I' && d.lines.length >= 2) ?? db.docs[0];
  const subtypes = TAX_TYPES.reduce((s, t) => s + t.subTypes.length, 0);
  const [model, setModel] = useState<'one' | 'rec' | 'inst'>('inst');
  const total = docTotal(sample);
  const today = new Date().toISOString().slice(0, 10);
  const inst = useMemo(() => buildInstallments(total, { kind: 'installments', count: 4, frequency: 'monthly', firstDueDate: today, downPaymentPct: 25 }), [total, today]);
  const runs = useMemo(() => recurringRuns({ kind: 'recurring', frequency: 'monthly', interval: 1, startDate: today, end: { type: 'never' }, delivery: 'submit_email', terms: 'net30' }, 5), [today]);

  const facts = [
    [L('Document schema', 'إصدار المستند'), 'v1.0'],
    [L('Tax types', 'أنواع الضرائب'), String(TAX_TYPES.length)],
    [L('Tax subtypes', 'أنواع فرعية'), String(subtypes)],
    [L('Unit codes', 'وحدات القياس'), String(UNIT_TYPES.length)],
    [L('Activity codes', 'أكواد الأنشطة'), String(ACTIVITY_CODES.length)],
    [L('Signature', 'التوقيع'), 'CAdES-BES'],
  ];

  return (
    <>
      {/* Hero: the thesis is the valid document itself */}
      <section className="pt-12 sm:pt-20 pb-16">
        <Wrap className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.02fr)] items-center">
          <div>
            <h1 className="text-display-xl">{L('Egyptian e‑invoicing, done properly.', 'الفاتورة الإلكترونية، كما يجب.')}</h1>
            <EchoLine en="Egyptian e-invoicing, done properly." ar="الفاتورة الإلكترونية المصرية، كما يجب." />
            <p className="mt-6 text-lead text-ink-muted max-w-[46ch]">{L('Issue ETA-valid invoices in Arabic and English, sign with your token, and get paid once, monthly or in installments.', 'أصدر فواتير معتمدة من المصلحة بالعربية والإنجليزية، ووقّع بالتوكن، واستلم دفعة واحدة أو شهرياً أو بالتقسيط.')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton to="/signup" variant="primary" size="lg">{L('Start free trial', 'ابدأ التجربة المجانية')}</LinkButton>
              <LinkButton to="/app" size="lg" icon={<ArrowRight className="size-4 rtl:rotate-180" />}>{L('Open the live demo', 'افتح العرض الحي')}</LinkButton>
            </div>
            <p className="mt-4 text-[13px] text-ink-subtle">{L('14 days on ETA pre-production. No card needed.', '١٤ يوماً على بيئة الاختبار. بدون بطاقة.')}</p>
          </div>
          <div className="relative">
            <div className="relative [&_.print-area]:shadow-pop pointer-events-none select-none" aria-label={L('A sample invoice produced by Fatura', 'نموذج فاتورة من فاتورة')}>
              <InvoicePaper doc={sample} company={db.company} env="production" />
            </div>
            <div className="absolute -bottom-10 -start-4 sm:-start-10 rotate-[-12deg] drop-shadow-[0_6px_16px_rgb(var(--shadow)/.18)] bg-canvas rounded-full">
              <Stamp size={128} />
            </div>
          </div>
        </Wrap>
      </section>

      {/* Spec strip: real facts from the code tables, not vanity metrics */}
      <section className="border-y border-line bg-surface">
        <Wrap>
          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-line rtl:divide-x-reverse">
            {facts.map(([k, v]) => (
              <div key={k} className="py-5 px-4 first:ps-0">
                <dt className="text-[12px] text-ink-subtle">{k}</dt>
                <dd className="font-display text-[22px] font-semibold text-ink mt-0.5 tabular">{v}</dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </section>

      {/* Lifecycle: a real sequence, so numbering is information */}
      <Section>
        <SectionHead title={L('Every document, from draft to Valid', 'كل مستند، من المسودة إلى الاعتماد')} lead={L('The same four steps ETA runs. Fatura shows you where each document is, and why — before your customer asks.', 'نفس الخطوات الأربع لدى المصلحة. فاتورة توضح لك أين يقف كل مستند ولماذا.')} />
        <ol className="grid gap-px rounded-card overflow-hidden border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {[
            [L('Draft', 'مسودة'), L('Built in the composer with the official tax maths. Pre-flight runs the ETA rules as you type.', 'تُبنى بقواعد الحساب الرسمية ويُفحص المستند أثناء الكتابة.'), <CheckCircle2 key="a" />],
            [L('Signed', 'موقّعة'), L('Hashed and signed CAdES-BES on your USB token, HSM or cloud seal. The key never leaves it.', 'تُوقّع بالتوكن أو HSM أو الختم السحابي. المفتاح لا يغادره.'), <Usb key="b" />],
            [L('Submitted', 'مُرسلة'), L('Sent in batches to the ETA submission API. Transport errors retry automatically.', 'تُرسل على دفعات لواجهة المصلحة مع إعادة المحاولة تلقائياً.'), <ArrowRight key="c" className="rtl:rotate-180" />],
            [L('Valid', 'صالحة'), L('ETA returns a UUID. The QR on the PDF lets anyone verify it on the portal.', 'تعيد المصلحة رقماً فريداً ورمز QR للتحقق على البوابة.'), <CheckCircle2 key="d" />],
          ].map(([t, d, icon], i) => (
            <li key={i} className="bg-surface p-6">
              <div className="flex items-center justify-between">
                <span className="font-display text-[13px] font-semibold text-ink-subtle tabular">0{i + 1}</span>
                <span className={cx('size-8 rounded-full grid place-items-center [&>svg]:size-4', i === 3 ? 'bg-ok text-white' : 'bg-accent-soft text-accent')}>{icon}</span>
              </div>
              <h3 className="mt-6 font-display text-[20px] font-semibold">{t}</h3>
              <p className="mt-2 text-ink-muted text-[14px]">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Payment models with live maths */}
      <Section tone="surface">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] items-start">
          <div>
            <SectionHead className="mb-6" title={L('Three ways to get paid. One compliant invoice.', 'ثلاث طرق للتحصيل. فاتورة واحدة متوافقة.')} lead={L('ETA only sees the tax document. How your customer pays — once, every month, or over a schedule — is handled without breaking the VAT rules.', 'المصلحة ترى المستند الضريبي فقط. طريقة الدفع تديرها فاتورة دون الإخلال بقواعد الضريبة.')} />
            <Segmented value={model} onChange={setModel} options={[
              { value: 'one', label: L('One payment', 'دفعة واحدة'), icon: <Zap className="size-4" /> },
              { value: 'rec', label: L('Recurring', 'متكررة'), icon: <Repeat className="size-4" /> },
              { value: 'inst', label: L('Installments', 'أقساط'), icon: <Layers className="size-4" /> },
            ]} />
            <ArrowLink to="/payments" className="mt-6">{L('How each model works with ETA', 'كيف يعمل كل نموذج مع المصلحة')}</ArrowLink>
          </div>
          <div className="card p-6 sm:p-8 animate-in" key={model}>
            {model === 'one' && (
              <div>
                <div className="text-[13px] text-ink-muted">{sample.internalID} · {sample.counterparty.name}</div>
                <div className="mt-1 font-display text-[34px] font-semibold tabular">{money(total)}</div>
                <div className="mt-6 grid grid-cols-3 gap-3 text-[13px]">
                  {[['net15', 15], ['net30', 30], ['net60', 60]].map(([t, d]) => { const due = new Date(); due.setDate(due.getDate() + (d as number)); return (
                    <div key={t as string} className={cx('rounded-control border p-3', t === 'net30' ? 'border-accent bg-accent-soft/60' : 'border-line')}><div className="text-ink-subtle">{L(`Net ${d}`, `خلال ${d} يوماً`)}</div><div className="font-medium mt-0.5">{date(due.toISOString())}</div></div>
                  ); })}
                </div>
                <p className="mt-5 text-ink-muted text-[14px]">{L('Reminders go out before and after the due date. Partial payments are tracked against the invoice.', 'تُرسل التذكيرات قبل وبعد الاستحقاق، وتُتابع الدفعات الجزئية.')}</p>
              </div>
            )}
            {model === 'rec' && (
              <div>
                <div className="flex items-center gap-2 text-[13px] text-ink-muted"><CalendarRange className="size-4 text-accent" />{L('Monthly retainer · auto-submit and email', 'عقد شهري · إرسال تلقائي وبريد')}</div>
                <ol className="mt-5 space-y-2">
                  {runs.map((r, i) => (
                    <li key={r} className="flex items-center justify-between rounded-control border border-line px-4 py-3">
                      <span className="flex items-center gap-3"><span className="font-display text-[12px] text-ink-subtle tabular w-5">{i + 1}</span>{date(r, 'long')}</span>
                      <span className="text-[12.5px] text-ink-muted">{i === 0 ? L('issued today', 'تصدر اليوم') : L('new ETA invoice', 'فاتورة جديدة')}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 text-ink-muted text-[14px]">{L('Each run is a new invoice dated that day. ETA rejects future-dated documents, so nothing is issued in advance.', 'كل دورة فاتورة جديدة بتاريخ يومها؛ لا يصدر شيء مقدماً.')}</p>
              </div>
            )}
            {model === 'inst' && (
              <div>
                <div className="flex items-baseline justify-between gap-3"><span className="text-[13px] text-ink-muted">{L('One invoice for', 'فاتورة واحدة بقيمة')}</span><span className="font-display text-[26px] font-semibold tabular">{money(total)}</span></div>
                <div className="mt-5 flex gap-1.5" aria-hidden>{inst.map((r) => <span key={r.n} className="h-2 rounded-full bg-accent" style={{ flex: r.amount }} />)}</div>
                <ul className="mt-4 divide-y divide-line text-[14px]">
                  {inst.map((r) => <li key={r.n} className="flex justify-between py-2.5"><span>{r.label === 'down' ? L('Down payment 25%', 'دفعة مقدمة ٢٥٪') : L(`Installment ${r.n}`, `القسط ${r.n}`)} <span className="text-ink-subtle">· {date(r.dueDate)}</span></span><span className="tabular font-medium">{money(r.amount)}</span></li>)}
                </ul>
                <p className="mt-4 text-ink-muted text-[14px]">{L('VAT is due when the invoice is issued, so ETA gets one invoice for the full amount. The schedule sums to the piastre.', 'الضريبة مستحقة عند الإصدار، لذا تُصدر فاتورة واحدة ويُطابق الجدول المبلغ بالقرش.')}</p>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* Bento of real product parts */}
      <Section>
        <SectionHead title={L('Catch ETA errors before you sign', 'التقط أخطاء المصلحة قبل التوقيع')} lead={L('The parts that save finance teams the most time, shown as they appear in the product.', 'الأجزاء الأكثر توفيراً للوقت كما تظهر في المنتج.')} />
        <div className="grid gap-4 md:grid-cols-6">
          <div className="card p-6 md:col-span-3">
            <h3 className="font-semibold text-[16px]">{L('Pre-flight check', 'الفحص المسبق')}</h3>
            <p className="text-ink-muted text-[14px] mt-1">{L('The rules ETA validates, run locally on every keystroke.', 'قواعد المصلحة تعمل محلياً مع كل تعديل.')}</p>
            <ul className="mt-5 space-y-2.5 text-[14px]">
              <li className="flex gap-2"><XCircle className="size-4 text-bad mt-0.5 shrink-0" />{L('Individuals need a 14-digit national ID at EGP 50,000 or more.', 'الأفراد يحتاجون رقماً قومياً عند ٥٠٬٠٠٠ جنيه أو أكثر.')}</li>
              <li className="flex gap-2"><XCircle className="size-4 text-bad mt-0.5 shrink-0" />{L('Line 2: "PCE" is not an ETA unit type.', 'البند ٢: "PCE" ليست وحدة معتمدة.')}</li>
              <li className="flex gap-2"><XCircle className="size-4 text-bad mt-0.5 shrink-0" />{L('Credit notes must reference the original invoice.', 'الإشعار الدائن يجب أن يشير للفاتورة الأصلية.')}</li>
              <li className="flex gap-2"><CheckCircle2 className="size-4 text-ok mt-0.5 shrink-0" />{L('Totals match the official calculation.', 'الإجماليات مطابقة للحساب الرسمي.')}</li>
            </ul>
          </div>
          <div className="card p-6 md:col-span-3">
            <h3 className="font-semibold text-[16px]">{L('Validation results, in plain words', 'نتائج التحقق بلغة واضحة')}</h3>
            <p className="text-ink-muted text-[14px] mt-1">{L('If ETA says Invalid, you see which validator failed and the exact field.', 'عند الرفض ترى المدقق الذي فشل والحقل بالتحديد.')}</p>
            <ul className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px]">
              {VALIDATORS.map((v) => <li key={v} className="flex items-center gap-1.5">{v === 'Code validator' ? <XCircle className="size-3.5 text-bad" /> : <CheckCircle2 className="size-3.5 text-ok" />}<span className={v === 'Code validator' ? 'text-ink font-medium' : 'text-ink-muted'}>{v}</span></li>)}
            </ul>
            <div className="mt-4 rounded-control bg-bad-soft border border-bad/20 p-3 text-[13px] text-bad font-medium">ItemCodeNotActive · <span className="font-mono">invoiceLines[0].itemCode</span></div>
          </div>
          <div className="card p-6 md:col-span-2">
            <span className="size-9 rounded-control bg-accent-soft text-accent grid place-items-center"><FileInput className="size-[18px]" /></span>
            <h3 className="font-semibold text-[16px] mt-4">{L('Supplier inbox', 'صندوق الموردين')}</h3>
            <p className="text-ink-muted text-[14px] mt-1">{L('Reject within the window, decline cancellations, and see recoverable input VAT.', 'ارفض خلال المهلة وارفض طلبات الإلغاء وتابع ضريبة المدخلات.')}</p>
          </div>
          <div className="card p-6 md:col-span-2">
            <span className="size-9 rounded-control bg-accent-soft text-accent grid place-items-center"><KeyRound className="size-[18px]" /></span>
            <h3 className="font-semibold text-[16px] mt-4">{L('Item codes, approved', 'أكواد أصناف معتمدة')}</h3>
            <p className="text-ink-muted text-[14px] mt-1">{L('Request EGS codes in bulk and track approval. Rejected codes can’t reach an invoice.', 'اطلب أكواد EGS دفعة واحدة وتابع الاعتماد.')}</p>
          </div>
          <div className="card p-6 md:col-span-2">
            <span className="size-9 rounded-control bg-accent-soft text-accent grid place-items-center"><Layers className="size-[18px]" /></span>
            <h3 className="font-semibold text-[16px] mt-4">{L('All 20 tax types', 'كل أنواع الضرائب العشرين')}</h3>
            <p className="text-ink-muted text-[14px] mt-1">{L('VAT, table tax, WHT, stamp and fees — calculated in the order ETA expects.', 'القيمة المضافة والجدول والخصم والدمغة والرسوم بالترتيب الصحيح.')}</p>
          </div>
        </div>
      </Section>

      {/* Dark band: the SDK under the hood */}
      <Section tone="ink">
        <div className="grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div>
            <h2 className="font-display text-title">{L('Built on the ETA SDK, end to end.', 'مبنية على حزمة المصلحة بالكامل.')}</h2>
            <p className="mt-3 opacity-70 max-w-[42ch]">{L('Every field maps one-to-one to the v1.0 document. The code tables come straight from the SDK and refresh nightly.', 'كل حقل يطابق مستند الإصدار 1.0، وجداول الأكواد من الحزمة مباشرة.')}</p>
            <Link to="/eta-guide" className="mt-6 inline-flex items-center gap-1.5 font-medium text-accent-soft hover:underline">{L('Read the ETA guide', 'اقرأ دليل المصلحة')}<ArrowRight className="size-4 rtl:rotate-180" /></Link>
          </div>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5 text-[14px]">
            {TAX_TYPES.slice(0, 6).map((t) => (
              <div key={t.code} className="border-t border-canvas/15 pt-3">
                <dt className="font-semibold"><span className="font-mono opacity-60 me-2">{t.code}</span>{bi(lang, t)}</dt>
                <dd className="opacity-60 mt-0.5 text-[13px]">{t.subTypes.slice(0, 4).map((s) => s.code).join(' · ')}{t.subTypes.length > 4 ? ` +${t.subTypes.length - 4}` : ''}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Section>

      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)]">
          <SectionHead className="mb-0" title={L('Questions finance teams ask first', 'أول أسئلة الفرق المالية')} lead={<>{L('More in the', 'المزيد في')} <Link className="link" to="/eta-guide">{L('ETA guide', 'دليل المصلحة')}</Link>.</>} />
          <Faq items={[
            [L('Do I need my own ETA credentials?', 'هل أحتاج بيانات ربط خاصة بي؟'), L('Yes. Each taxpayer registers Fatura as an ERP on the ETA portal and gets a client ID and secret. Setup walks you through it.', 'نعم. كل ممول يسجل فاتورة كنظام ERP ويحصل على معرّف وسر، والإعداد يرشدك.')],
            [L('Can recurring invoices go out while I am away?', 'هل تُرسل الفواتير المتكررة في غيابي؟'), L('With cloud or HSM signing, yes. With a USB token, runs wait as drafts until the signer is online and you get a notification.', 'مع التوقيع السحابي نعم. مع التوكن تنتظر كمسودات حتى يتصل البرنامج.')],
            [L('How are installments taxed?', 'كيف تُحتسب ضريبة الأقساط؟'), L('VAT is due on issue, so ETA receives one invoice for the full amount and Fatura tracks the installments as receivables.', 'الضريبة مستحقة عند الإصدار، فتصدر فاتورة واحدة وتُتابع الأقساط كمستحقات.')],
            [L('What if ETA marks a document Invalid?', 'ماذا لو اعتُبر المستند غير صالح؟'), L('You see the failing validator and field. One click creates a corrected copy to resubmit; the invalid one stays on record.', 'ترى سبب الرفض والحقل. بنقرة تنشئ نسخة مصححة لإعادة الإرسال.')],
          ]} />
        </div>
      </Section>

      <CtaBand title={L('Issue your first valid invoice this week.', 'أصدر أول فاتورة صالحة هذا الأسبوع.')} lead={L('Start on pre-production, switch to production when your test invoices validate.', 'ابدأ على بيئة الاختبار وانتقل للإنتاج عند اعتماد فواتيرك التجريبية.')}
        primary={{ to: '/signup', label: L('Start free trial', 'ابدأ التجربة المجانية') }} secondary={{ to: '/contact?topic=demo', label: L('Book a demo', 'احجز عرضاً') }} />
    </>
  );
}
