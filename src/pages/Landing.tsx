import { ArrowRight, Check, FileCheck2, KeyRound, Layers, Repeat, Usb, Wallet, Zap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { bi, useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Logo } from '@/components/brand';
import { InvoicePaper } from '@/components/InvoicePaper';
import { LinkButton, Segmented, cx } from '@/components/ui';
import { Prefs } from '@/layouts/Shell';

type Billing = 'monthly' | 'yearly' | 'installments' | 'one-time';

export function Landing() {
  const { db } = useStore();
  const { L, lang, money } = useI18n();
  const [billing, setBilling] = useState<Billing>('yearly');
  const [model, setModel] = useState<'one' | 'rec' | 'inst'>('rec');
  const sample = db.docs.find((d) => d.direction === 'sent' && d.status === 'Valid' && d.documentType === 'I' && d.lines.length >= 2) ?? db.docs[0];

  const models = {
    one: { icon: <Zap className="size-5" />, title: L('One payment', 'دفعة واحدة'), body: L('Issue, submit, get paid. Net 15/30/60 terms with automatic reminders, and a payment link on every invoice.', 'أصدر وأرسل واستلم. شروط دفع مع تذكيرات تلقائية.'), points: [L('Due-date tracking & aging', 'متابعة الاستحقاق وأعمار الديون'), L('Partial payments', 'دفعات جزئية'), L('InstaPay, transfer, cheque', 'إنستاباي وتحويل وشيك')] },
    rec: { icon: <Repeat className="size-5" />, title: L('Recurring', 'متكررة'), body: L('Retainers, rent and subscriptions. Each run issues a fresh ETA invoice dated that day — submitted automatically or held for your approval.', 'عقود ودعم واشتراكات. كل دورة تُصدر فاتورة جديدة بتاريخ يومها.'), points: [L('Weekly to yearly, any interval', 'من أسبوعي إلى سنوي'), L('End after N runs or on a date', 'انتهاء بعدد أو بتاريخ'), L('Auto-submit + email, or draft', 'إرسال تلقائي أو مسودة')] },
    inst: { icon: <Layers className="size-5" />, title: L('Installments', 'أقساط'), body: L('One ETA invoice for the full amount, so VAT is right — then a down payment and a schedule your customer can actually keep.', 'فاتورة واحدة بالمبلغ كاملاً لضبط الضريبة، ثم جدول أقساط واضح.'), points: [L('2–24 installments, any frequency', 'من ٢ إلى ٢٤ قسطاً'), L('Down payment %', 'نسبة دفعة مقدمة'), L('Late-installment alerts', 'تنبيهات التأخير')] },
  }[model];

  return (
    <div className="min-h-screen bg-canvas overflow-x-clip">
      <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-line">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <Link to="/"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-6 ms-8 text-[13.5px] text-ink-muted">
            <a href="#how" className="hover:text-ink">{L('How it works', 'كيف تعمل')}</a>
            <a href="#payments" className="hover:text-ink">{L('Payments', 'المدفوعات')}</a>
            <a href="#pricing" className="hover:text-ink">{L('Pricing', 'الأسعار')}</a>
          </nav>
          <div className="flex-1" />
          <Prefs />
          <Link to="/signin" className="hidden sm:inline text-[13.5px] font-medium text-ink-muted hover:text-ink px-2">{L('Sign in', 'تسجيل الدخول')}</Link>
          <LinkButton to="/signup" variant="primary" size="sm">{L('Start free', 'ابدأ مجاناً')}</LinkButton>
        </div>
      </header>

      <section className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] items-center">
        <div>
          <h1 className="text-[40px] sm:text-[56px] leading-[1.02] font-semibold tracking-[-0.035em] text-ink">{L('Egyptian e‑invoicing, done properly.', 'الفاتورة الإلكترونية المصرية، كما يجب.')}</h1>
          <p className="mt-5 text-[17px] text-ink-muted max-w-[46ch]">{L('Issue ETA-valid invoices in Arabic and English, sign with your token, and get paid once, monthly or in installments.', 'أصدر فواتير معتمدة من المصلحة بالعربية والإنجليزية، ووقّع بالتوكن، واستلم دفعة واحدة أو شهرياً أو بالتقسيط.')}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton to="/signup" variant="primary" size="lg">{L('Start free trial', 'ابدأ التجربة المجانية')}</LinkButton>
            <LinkButton to="/app" size="lg" icon={<ArrowRight className="size-4 rtl:rotate-180" />}>{L('Open the demo', 'افتح العرض')}</LinkButton>
          </div>
          <p className="mt-4 text-[13px] text-ink-subtle">{L('14 days on ETA pre-production. No card needed.', '١٤ يوماً على بيئة الاختبار. بدون بطاقة.')}</p>
        </div>
        <div className="relative">
          <div className="absolute -inset-6 rounded-[28px] bg-accent-soft/70 -rotate-2 rtl:rotate-2" aria-hidden />
          <div className="relative rotate-1 rtl:-rotate-1 pointer-events-none select-none [&_.print-area]:shadow-pop" aria-label={L('Sample invoice produced by Fatura', 'نموذج فاتورة من فاتورة')}>
            <InvoicePaper doc={sample} company={db.company} env="production" />
          </div>
        </div>
      </section>

      <section id="how" className="border-y border-line bg-surface">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.025em] max-w-[22ch]">{L('From ETA credentials to first valid invoice in an afternoon.', 'من بيانات الربط إلى أول فاتورة صالحة في ساعات.')}</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              [<KeyRound key="k" />, L('Connect your ETA account', 'اربط حساب المصلحة'), L('Register Fatura as your ERP on the ETA portal and paste the client ID and secret. Test on pre-production first.', 'سجّل فاتورة كنظام ERP والصق المعرّف والسر. اختبر أولاً.')],
              [<Usb key="u" />, L('Plug in your signing token', 'وصّل توكن التوقيع'), L('Fatura Signer talks to your Egypt Trust or MCDR token locally. Cloud and HSM signing for unattended runs.', 'برنامج التوقيع يتعامل مع التوكن محلياً. توقيع سحابي متاح.')],
              [<FileCheck2 key="f" />, L('Issue and track', 'أصدر وتابع'), L('Pre-flight checks catch ETA errors before you sign. Every document shows its validation result, QR and payment status.', 'الفحص المسبق يلتقط الأخطاء قبل التوقيع. كل مستند يعرض نتيجته ورمز QR وحالة الدفع.')],
            ].map(([icon, t, d], i) => (
              <li key={i} className="relative ps-14">
                <span className="absolute start-0 top-0 size-10 rounded-md bg-accent-soft text-accent grid place-items-center [&>svg]:size-5">{icon}</span>
                <div className="text-[12px] font-semibold text-ink-subtle tabular">0{i + 1}</div>
                <h3 className="font-semibold text-[17px] text-ink">{t}</h3>
                <p className="mt-1.5 text-ink-muted">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="payments" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-20 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start">
        <div>
          <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.025em]">{L('Three ways to get paid. One compliant invoice.', 'ثلاث طرق للتحصيل. فاتورة واحدة متوافقة.')}</h2>
          <p className="mt-3 text-ink-muted max-w-[52ch]">{L('ETA only sees the tax document. How your customer pays — once, every month, or over a schedule — is handled by Fatura without breaking the VAT rules.', 'المصلحة ترى المستند الضريبي فقط. طريقة الدفع تديرها فاتورة دون الإخلال بقواعد الضريبة.')}</p>
          <Segmented className="mt-6" value={model} onChange={setModel} options={[{ value: 'one', label: L('One payment', 'دفعة واحدة') }, { value: 'rec', label: L('Recurring', 'متكررة') }, { value: 'inst', label: L('Installments', 'أقساط') }]} />
        </div>
        <div className="card p-6 sm:p-8 animate-in" key={model}>
          <div className="size-11 rounded-md bg-accent text-accent-on grid place-items-center">{models.icon}</div>
          <h3 className="mt-4 text-[22px] font-semibold">{models.title}</h3>
          <p className="mt-2 text-ink-muted">{models.body}</p>
          <ul className="mt-5 grid sm:grid-cols-3 gap-3">{models.points.map((p) => <li key={p} className="flex gap-2 text-[13.5px]"><Check className="size-4 text-ok shrink-0 mt-0.5" />{p}</li>)}</ul>
        </div>
      </section>

      <section className="bg-ink text-canvas">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-16 grid gap-10 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.025em]">{L('Built on the ETA SDK, end to end.', 'مبنية على حزمة المصلحة بالكامل.')}</h2>
          <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-5 text-[14px]">
            {[
              [L('Document types', 'أنواع المستندات'), L('Invoice, credit & debit notes, export invoices — v1.0 schema', 'فاتورة وإشعارات وفواتير تصدير — الإصدار 1.0')],
              [L('Official tax maths', 'حساب ضريبي رسمي'), L('T1–T20 with table tax, fees and WHT in the right order', 'كل أنواع الضرائب بالترتيب الصحيح')],
              [L('Received documents', 'المستندات الواردة'), L('Reject within the window, decline cancellations, claim input VAT', 'الرفض خلال المهلة ورفض الإلغاء')],
              [L('Item codes', 'أكواد الأصناف'), L('EGS code requests and GS1 barcodes, with approval tracking', 'طلبات أكواد EGS ومتابعة الاعتماد')],
              [L('E-receipts', 'الإيصالات الإلكترونية'), L('POS receipts v1.2 from registered devices', 'إيصالات نقاط البيع من الأجهزة المسجلة')],
              [L('Arabic first', 'العربية أولاً'), L('Full RTL interface and bilingual printouts', 'واجهة كاملة من اليمين لليسار')],
            ].map(([k, v]) => <div key={k} className="border-t border-canvas/15 pt-3"><dt className="font-semibold">{k}</dt><dd className="text-canvas/70 mt-0.5">{v}</dd></div>)}
          </dl>
        </div>
      </section>

      <section id="pricing" className="max-w-[1200px] mx-auto px-4 sm:px-6 py-20">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-[28px] sm:text-[34px] font-semibold tracking-[-0.025em]">{L('Pricing that fits your cash flow', 'أسعار تناسب تدفقك النقدي')}</h2>
            <p className="mt-2 text-ink-muted">{L('Pay monthly, yearly, in installments, or once. Prices exclude 14% VAT.', 'ادفع شهرياً أو سنوياً أو بالتقسيط أو مرة واحدة. الأسعار لا تشمل الضريبة.')}</p>
          </div>
          <Segmented value={billing} onChange={setBilling} options={[{ value: 'monthly', label: L('Monthly', 'شهري') }, { value: 'yearly', label: L('Yearly', 'سنوي') }, { value: 'installments', label: L('Installments', 'تقسيط') }, { value: 'one-time', label: L('One-time', 'مرة واحدة') }]} />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {db.admin.plans.filter((p) => p.active).map((p) => {
            const [price, unit] = billing === 'monthly' ? [p.monthly, L('/ month', '/ شهر')] : billing === 'yearly' ? [p.yearly, L('/ year', '/ سنة')] : billing === 'installments' ? [p.installments.amount, L(`× ${p.installments.count}`, `× ${p.installments.count}`)] : [p.oneTime, L('once', 'مرة واحدة')];
            return (
              <div key={p.id} className={cx('card flex flex-col overflow-hidden', p.featured && 'ring-2 ring-accent border-accent')}>
                <div className={cx('px-6 py-4 border-b border-line', p.featured ? 'bg-accent text-accent-on' : 'bg-sunken/60')}>
                  <div className="flex items-center justify-between"><span className="font-semibold text-[17px]">{bi(lang, { en: p.name, ar: p.nameAr })}</span>{p.featured && <span className="text-[12px] font-medium opacity-90">{L('Most chosen', 'الأكثر اختياراً')}</span>}</div>
                  <p className={cx('text-[13px] mt-0.5', p.featured ? 'opacity-85' : 'text-ink-muted')}>{bi(lang, p.blurb)}</p>
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-baseline gap-1.5"><span className="text-[34px] font-semibold tabular tracking-[-0.02em]">{money(price, 'EGP').replace(/\.00(?=\D*$)/, '')}</span><span className="text-ink-muted">{unit}</span></div>
                  {billing === 'installments' && <p className="text-[12.5px] text-ink-subtle mt-1">{L('Yearly licence, interest-free', 'ترخيص سنوي بدون فوائد')}</p>}
                  {billing === 'one-time' && <p className="text-[12.5px] text-ink-subtle mt-1">{L('Lifetime licence + 12 months of updates', 'ترخيص دائم + ١٢ شهراً تحديثات')}</p>}
                  <ul className="mt-5 space-y-2 text-[13.5px] flex-1">
                    <li className="flex gap-2"><Check className="size-4 text-ok mt-0.5 shrink-0" />{L(`${p.docsPerMonth.toLocaleString()} documents / month`, `${p.docsPerMonth.toLocaleString()} مستند / شهر`)}</li>
                    <li className="flex gap-2"><Check className="size-4 text-ok mt-0.5 shrink-0" />{L(`${p.users} users · ${p.branches} ${p.branches === 1 ? 'branch' : 'branches'}`, `${p.users} مستخدم · ${p.branches} فرع`)}</li>
                    {p.features.map((f) => <li key={f.en} className="flex gap-2"><Check className="size-4 text-ok mt-0.5 shrink-0" />{bi(lang, f)}</li>)}
                  </ul>
                  <LinkButton to="/signup" variant={p.featured ? 'primary' : 'secondary'} className="mt-6 w-full">{L(`Choose ${p.name}`, `اختر ${p.nameAr}`)}</LinkButton>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex items-center gap-2 text-[13px] text-ink-muted"><Wallet className="size-4" />{L('Fatura bills you with ETA-valid invoices, of course.', 'وبالطبع، فاتورة تصدر لك فواتير إلكترونية صالحة.')}</div>
      </section>

      <section className="border-t border-line">
        <div className="max-w-[820px] mx-auto px-4 sm:px-6 py-16">
          <h2 className="text-[24px] font-semibold mb-6">{L('Questions', 'أسئلة شائعة')}</h2>
          {[
            [L('Do I need my own ETA credentials?', 'هل أحتاج بيانات ربط خاصة بي؟'), L('Yes. Each taxpayer registers Fatura as an ERP on the ETA portal and gets a client ID and secret. We guide you through it during setup.', 'نعم. كل ممول يسجل فاتورة كنظام ERP ويحصل على معرّف وسر. نرشدك خلال الإعداد.')],
            [L('Can recurring invoices be submitted while I am away?', 'هل تُرسل الفواتير المتكررة في غيابي؟'), L('With cloud or HSM signing, yes. With a USB token, runs wait as drafts until the signer is online — you get a notification.', 'مع التوقيع السحابي نعم. مع التوكن تنتظر كمسودات حتى يتصل البرنامج.')],
            [L('How are installments taxed?', 'كيف تُحتسب ضريبة الأقساط؟'), L('VAT is due when the invoice is issued, so Fatura issues one ETA invoice for the full amount and tracks the installments as receivables.', 'الضريبة مستحقة عند الإصدار، لذا تُصدر فاتورة واحدة ويُتابع التحصيل كأقساط.')],
            [L('What happens if ETA rejects a document?', 'ماذا لو رفضت المصلحة مستنداً؟'), L('You see which validator failed and why. One click creates a corrected copy to resubmit; the invalid one stays on record.', 'ترى سبب الرفض بالتحديد. بنقرة تنشئ نسخة مصححة لإعادة الإرسال.')],
          ].map(([q, a]) => (
            <details key={q} className="group border-b border-line py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-ink">{q}<span className="text-ink-subtle group-open:rotate-45 transition-transform text-[20px] leading-none">+</span></summary>
              <p className="mt-2 text-ink-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-line bg-surface">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-8 flex flex-wrap items-center justify-between gap-4 text-[13px] text-ink-muted">
          <Logo />
          <span>{L('Independent software. Not affiliated with the Egyptian Tax Authority.', 'برنامج مستقل وغير تابع لمصلحة الضرائب المصرية.')}</span>
          <Link to="/admin" className="hover:text-ink">{L('Staff sign-in', 'دخول الموظفين')}</Link>
        </div>
      </footer>
    </div>
  );
}
