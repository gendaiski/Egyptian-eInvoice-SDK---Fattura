import { CheckCircle2, ClipboardCheck, Database, Eye, KeyRound, Lock, Mail, ScrollText, Server, ShieldCheck, Usb } from 'lucide-react';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ENDPOINTS } from '@/eta/client';
import { bi, useI18n } from '@/i18n';
import { uid, type Lead } from '@/store/model';
import { useStore } from '@/store/store';
import { Badge, Button, CopyButton, Field, Input, Select, Textarea, cx } from '@/components/ui';
import { Stamp } from '@/components/Stamp';
import { CtaBand, PageHero, Section, SectionHead, Wrap } from '../kit';

/* ---------------- Security ---------------- */
export function Security() {
  const { L } = useI18n();
  const flow = [
    [<Usb key="a" />, L('Your PC + USB token', 'جهازك + التوكن'), L('Holds the private key. Signs a hash.', 'يحمل المفتاح ويوقّع البصمة.')],
    [<Lock key="b" />, L('Fatura Signer', 'برنامج التوقيع'), L('Receives the hash over an authenticated channel; returns the signature.', 'يستلم البصمة عبر قناة موثقة ويعيد التوقيع.')],
    [<Server key="c" />, L('Fatura API', 'خادم فاتورة'), L('Builds the document, embeds the signature, submits.', 'يبني المستند ويضيف التوقيع ويرسله.')],
    [<CheckCircle2 key="d" />, 'ETA', L('Validates and returns the UUID.', 'تتحقق وتعيد الرقم الفريد.')],
  ];
  return (
    <>
      <PageHero kicker={L('Security', 'الأمان')} title={L('Your signing key never leaves your token.', 'مفتاح توقيعك لا يغادر التوكن.')} lead={L('Fatura is designed so that the parts that can issue tax documents in your name stay under your control.', 'صُممت فاتورة لتبقى الأجزاء القادرة على إصدار مستندات باسمك تحت سيطرتك.')} />
      <Section>
        <SectionHead title={L('How a document is signed', 'كيف يُوقّع المستند')} />
        <ol className="grid gap-3 md:grid-cols-4">
          {flow.map(([icon, t, d], i) => (
            <li key={i} className="relative card p-5">
              <span className="size-9 rounded-control bg-accent-soft text-accent grid place-items-center [&>svg]:size-[18px]">{icon}</span>
              <h3 className="mt-4 font-semibold">{t}</h3><p className="mt-1 text-[13.5px] text-ink-muted">{d}</p>
              {i < 3 && <span aria-hidden className="hidden md:block absolute top-9 -end-3 w-3 h-px bg-line-strong" />}
            </li>
          ))}
        </ol>
      </Section>
      <Section tone="surface">
        <div className="grid gap-x-10 gap-y-8 md:grid-cols-2 lg:grid-cols-3">
          {[
            [<KeyRound key="1" />, L('Secrets in a key vault', 'الأسرار في خزنة مفاتيح'), L('ETA client secrets are encrypted per tenant and never sent to a browser.', 'أسرار الربط مشفرة لكل عميل ولا تصل للمتصفح.')],
            [<Database key="2" />, L('Data in Egypt', 'البيانات في مصر'), L('Primary storage in an Egyptian region, encrypted at rest; TLS 1.3 in transit.', 'تخزين أساسي في مصر مشفر، وTLS 1.3 أثناء النقل.')],
            [<ShieldCheck key="3" />, L('Tenant isolation', 'عزل العملاء'), L('Row-level isolation in the database; every query is scoped to one company.', 'عزل على مستوى الصفوف؛ كل استعلام لشركة واحدة.')],
            [<Eye key="4" />, L('Audited support access', 'وصول دعم مُراقَب'), L('Staff can only view a workspace read-only, time-boxed and logged.', 'الموظفون يرون مساحة العمل للقراءة فقط وبمدة محددة ومسجلة.')],
            [<ScrollText key="5" />, L('Five-year retention', 'احتفاظ خمس سنوات'), L('Submitted JSON, signatures, validation results and PDFs are kept for your records.', 'نحتفظ بالمستندات والتواقيع والنتائج لسجلاتك.')],
            [<ClipboardCheck key="6" />, L('Roles and MFA', 'الأدوار والتحقق الثنائي'), L('Five workspace roles; two-step sign-in for every user, hardware keys for staff.', 'خمسة أدوار وتحقق بخطوتين لكل مستخدم.')],
          ].map(([icon, t, d], i) => <div key={i}><span className="text-accent [&>svg]:size-6">{icon}</span><h3 className="mt-3 font-semibold text-[16px]">{t}</h3><p className="mt-1 text-ink-muted text-[14px]">{d}</p></div>)}
        </div>
      </Section>
      <CtaBand title={L('Need our security questionnaire answered?', 'تحتاج إجابة استبيان الأمان؟')} primary={{ to: '/contact?topic=sales', label: L('Contact us', 'تواصل معنا') }} />
    </>
  );
}

/* ---------------- Status (reads the admin ETA health data) ---------------- */
export function Status() {
  const { db } = useStore();
  const { L, lang, date } = useI18n();
  const api = db.admin.api;
  const incident = api.reduce((a, d) => (d.errors > a.errors ? d : a), api[0]);
  const today = api[api.length - 1];
  const degraded = today.errors > 100 || today.p95 > 2000;
  const fmt = (d: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'short' }).format(new Date(d));
  const comps = [
    [L('Fatura web app', 'تطبيق فاتورة'), 'ok'], [L('Fatura API', 'واجهة فاتورة'), 'ok'], [L('Signer gateway', 'بوابة التوقيع'), 'ok'],
    ...ENDPOINTS.slice(0, 6).map((e) => [`ETA · ${e.op}`, 'ok']), ['ETA · Taxpayer notifications', 'warn'],
  ];
  return (
    <>
      <section className="pt-12 sm:pt-16 pb-10 border-b border-line">
        <Wrap>
          <div className={cx('flex items-center gap-4 rounded-card p-5 border', degraded ? 'bg-warn-soft border-warn/30' : 'bg-ok-soft border-ok/25')}>
            <CheckCircle2 className={cx('size-7', degraded ? 'text-warn' : 'text-ok')} />
            <div><h1 className="text-[24px] sm:text-[28px]">{degraded ? L('Some systems degraded', 'بعض الأنظمة متأثرة') : L('All systems operational', 'كل الأنظمة تعمل')}</h1><p className="text-ink-muted text-[14px]">{L('Includes the ETA endpoints we depend on. Updated', 'يشمل واجهات المصلحة. آخر تحديث')} {date(new Date().toISOString(), 'datetime')}</p></div>
          </div>
        </Wrap>
      </section>
      <Section>
        <SectionHead title={L('Last 30 days', 'آخر ٣٠ يوماً')} lead={L('Each bar is a day of document submissions across all tenants.', 'كل عمود يوم من إرسال المستندات لكل العملاء.')} />
        <div className="card p-5">
          <div className="flex items-end gap-[3px] h-12" dir="ltr">
            {api.map((d) => <span key={d.date} title={`${fmt(d.date)} · ${d.errors} transport errors`} className={cx('flex-1 rounded-sm', d.errors > 100 ? 'bg-warn h-full' : 'bg-ok h-full')} />)}
          </div>
          <div className="flex justify-between text-[12px] text-ink-subtle mt-2" dir="ltr"><span>{fmt(api[0].date)}</span><span>{L('Today', 'اليوم')}</span></div>
        </div>
        <ul className="mt-6 card divide-y divide-line">
          {comps.map(([n, s]) => <li key={n} className="flex items-center justify-between gap-3 px-5 py-3.5 text-[14px]"><span>{n}</span><Badge tone={s === 'ok' ? 'ok' : 'warn'}>{s === 'ok' ? L('Operational', 'يعمل') : L('Degraded', 'متأثر')}</Badge></li>)}
        </ul>
      </Section>
      <Section tone="surface">
        <SectionHead title={L('Incident history', 'سجل الأعطال')} />
        <article className="card p-6 max-w-[760px]">
          <div className="flex flex-wrap items-center gap-3"><Badge tone="warn">{L('Resolved', 'تم الحل')}</Badge><span className="text-[13px] text-ink-muted">{date(incident.date, 'long')}</span></div>
          <h3 className="mt-3 font-semibold text-[17px]">{L('ETA submission API returned 503 errors', 'واجهة إرسال المصلحة أعادت أخطاء 503')}</h3>
          <p className="mt-2 text-ink-muted text-[14px]">{L(`For about 40 minutes ETA rejected submissions with 503 (${incident.errors} errors recorded). Fatura queued the documents and retried with backoff; every document was delivered and no data was lost.`, `لنحو ٤٠ دقيقة رفضت المصلحة الإرسال (${incident.errors} خطأ). حفظت فاتورة المستندات وأعادت المحاولة دون فقد.`)}</p>
        </article>
      </Section>
    </>
  );
}

/* ---------------- About ---------------- */
export function About() {
  const { L } = useI18n();
  return (
    <>
      <PageHero title={L('Tax compliance should feel like good software.', 'الامتثال الضريبي يجب أن يكون برنامجاً جيداً.')} lead={L('Fatura exists because issuing a correct invoice in Egypt shouldn’t take a consultant, a spreadsheet and a prayer.', 'وُجدت فاتورة لأن إصدار فاتورة صحيحة في مصر لا يجب أن يحتاج مستشاراً وجدولاً وكثيراً من الحظ.')}
        aside={<div className="grid place-items-center"><Stamp size={220} label="FATURA" sub="فاتورة" ring="ARABIC FIRST · COMPLIANT BY CONSTRUCTION · " /></div>} />
      <Section>
        <SectionHead title={L('What we hold ourselves to', 'ما نلتزم به')} />
        <div className="grid gap-8 md:grid-cols-3">
          {[
            [L('Arabic first, not translated', 'العربية أولاً وليست ترجمة'), L('Every screen and document works right-to-left, with Arabic written by people who file Egyptian taxes.', 'كل شاشة ومستند يعمل من اليمين لليسار بلغة يكتبها من يتعامل مع الضرائب.')],
            [L('Compliant by construction', 'متوافقة من الأساس'), L('The ETA rules live in the product’s core, tested, so a mistake is caught before it is signed.', 'قواعد المصلحة في قلب المنتج ومختبرة، فيُكتشف الخطأ قبل التوقيع.')],
            [L('Honest about tax', 'صادقون في الضريبة'), L('We say when something is a rule, when it is our default, and when you should ask your advisor.', 'نوضح متى يكون الأمر قاعدة ومتى يكون اختياراً ومتى تسأل مستشارك.')],
          ].map(([t, d]) => <div key={t} className="border-t-2 border-accent pt-5"><h3 className="font-display text-[20px] font-semibold">{t}</h3><p className="mt-2 text-ink-muted">{d}</p></div>)}
        </div>
      </Section>
      <Section tone="surface">
        <div className="max-w-[720px]">
          <h2 className="font-display text-title">{L('Independent by design', 'مستقلة بطبيعتها')}</h2>
          <p className="mt-3 text-lead text-ink-muted">{L('Fatura is independent software built on the public ETA SDK. We are not affiliated with or endorsed by the Egyptian Tax Authority.', 'فاتورة برنامج مستقل مبني على حزمة المصلحة العامة، وغير تابع لمصلحة الضرائب المصرية أو معتمد منها.')}</p>
        </div>
      </Section>
      <CtaBand title={L('Talk to the team.', 'تحدث مع الفريق.')} primary={{ to: '/contact', label: L('Contact us', 'تواصل معنا') }} secondary={{ to: '/signup', label: L('Start free', 'ابدأ مجاناً') }} />
    </>
  );
}

/* ---------------- Contact → admin Leads ---------------- */
export function Contact() {
  const { db, set } = useStore();
  const { L, lang } = useI18n();
  const [params] = useSearchParams();
  const plan = db.admin.plans.find((p) => p.id === params.get('plan'));
  const [f, setF] = useState({ name: '', email: '', company: '', phone: '', topic: (params.get('topic') as Lead['topic']) || 'demo', docs: params.get('docs') ?? '', message: '' });
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState<Lead | null>(null);
  const errors = useMemo(() => ({
    name: f.name.trim().length < 2 ? L('Enter your name.', 'أدخل اسمك.') : '',
    email: /^\S+@\S+\.\S+$/.test(f.email) ? '' : L('Enter a valid work email.', 'أدخل بريداً صحيحاً.'),
    company: f.company.trim() ? '' : L('Enter your company name.', 'أدخل اسم الشركة.'),
    message: f.message.trim().length < 10 ? L('Tell us a little more (10 characters or more).', 'أخبرنا المزيد (١٠ أحرف على الأقل).') : '',
  }), [f, L]);
  const submit = (e: FormEvent) => {
    e.preventDefault(); setTouched(true);
    if (Object.values(errors).some(Boolean)) return;
    const lead: Lead = { id: uid('l'), at: new Date().toISOString(), name: f.name, email: f.email, company: f.company, phone: f.phone || undefined, topic: f.topic, message: f.message, source: plan ? 'pricing' : 'contact', planId: plan?.id, billing: params.get('billing') ?? undefined, docsPerMonth: f.docs ? Number(f.docs) : undefined, status: 'new' };
    set((x) => { x.admin.leads.unshift(lead); });
    setSent(lead);
  };
  const err = (k: keyof typeof errors) => (touched ? errors[k] || undefined : undefined);
  return (
    <>
      <PageHero title={L('Talk to Fatura.', 'تحدث مع فاتورة.')} lead={L('Demos, pricing for larger volumes, partnerships, or help going live. A person replies within one working day.', 'عروض وأسعار للكميات الكبيرة وشراكات ومساعدة في التشغيل. يرد عليك شخص خلال يوم عمل.')} />
      <Section>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-start">
          {sent ? (
            <div className="card p-8 text-center animate-in" role="status">
              <div className="grid place-items-center"><Stamp size={120} label="RECEIVED" sub="تم الاستلام" tone="ok" ring="FATURA · SALES · المبيعات · " /></div>
              <h2 className="mt-4 font-display text-[24px] font-semibold">{L(`Thanks, ${sent.name.split(' ')[0]}.`, `شكراً يا ${sent.name.split(' ')[0]}.`)}</h2>
              <p className="mt-2 text-ink-muted max-w-[44ch] mx-auto">{L('Your request is in our sales inbox with reference', 'طلبك في صندوق المبيعات برقم مرجعي')} <span className="font-mono text-ink">{sent.id.toUpperCase()}</span>. {L('We’ll email', 'سنراسلك على')} {sent.email}.</p>
              <p className="mt-4 text-[12.5px] text-ink-subtle">{L('In this demo, the request appears in Admin → Leads.', 'في هذا العرض يظهر الطلب في الإدارة ← العملاء المحتملون.')} <Link to="/admin/leads" className="link">{L('Open it', 'افتحه')}</Link></p>
              <Button className="mt-6" onClick={() => { setSent(null); setF({ ...f, message: '' }); setTouched(false); }}>{L('Send another request', 'أرسل طلباً آخر')}</Button>
            </div>
          ) : (
            <form noValidate onSubmit={submit} className="card p-6 sm:p-8 grid gap-4 sm:grid-cols-2">
              {plan && <div className="sm:col-span-2 rounded-control bg-accent-soft/60 border border-accent/20 p-3 text-[13.5px]">{L('About the', 'بخصوص باقة')} <span className="font-semibold">{bi(lang, { en: plan.name, ar: plan.nameAr })}</span> {L('plan', '')}{params.get('billing') ? ` · ${params.get('billing')}` : ''}</div>}
              <Field label={L('Full name', 'الاسم بالكامل')} error={err('name')}>{(id) => <Input id={id} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} aria-invalid={!!err('name')} />}</Field>
              <Field label={L('Work email', 'بريد العمل')} error={err('email')}>{(id) => <Input id={id} type="email" dir="ltr" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} aria-invalid={!!err('email')} />}</Field>
              <Field label={L('Company', 'الشركة')} error={err('company')}>{(id) => <Input id={id} autoComplete="organization" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} aria-invalid={!!err('company')} />}</Field>
              <Field label={L('Phone', 'الهاتف')} optional>{(id) => <Input id={id} type="tel" dir="ltr" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
              <Field label={L('What can we help with?', 'كيف نساعدك؟')}>{(id) => <Select id={id} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value as Lead['topic'] })}><option value="demo">{L('Book a demo', 'حجز عرض')}</option><option value="sales">{L('Pricing and plans', 'الأسعار والباقات')}</option><option value="partnership">{L('Partnership / accounting firm', 'شراكة / مكتب محاسبة')}</option><option value="support">{L('Help going live', 'مساعدة في التشغيل')}</option></Select>}</Field>
              <Field label={L('Documents per month', 'المستندات شهرياً')} optional>{(id) => <Input id={id} type="number" min={0} value={f.docs} onChange={(e) => setF({ ...f, docs: e.target.value })} />}</Field>
              <Field label={L('Message', 'الرسالة')} error={err('message')} className="sm:col-span-2">{(id) => <Textarea id={id} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} aria-invalid={!!err('message')} placeholder={L('Your ERP, number of branches, what you issue today…', 'نظامك وعدد الفروع وما تصدره اليوم…')} />}</Field>
              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[12.5px] text-ink-subtle max-w-[44ch]">{L('We use these details only to reply to you. See the privacy policy.', 'نستخدم هذه البيانات للرد عليك فقط. راجع سياسة الخصوصية.')}</p>
                <Button type="submit" variant="primary" size="lg">{L('Send request', 'أرسل الطلب')}</Button>
              </div>
            </form>
          )}
          <aside className="space-y-4">
            {[[L('Sales', 'المبيعات'), 'sales@fatura.eg'], [L('Support', 'الدعم'), 'support@fatura.eg'], [L('Security', 'الأمان'), 'security@fatura.eg']].map(([k, v]) => (
              <div key={k} className="card p-5 flex items-center justify-between gap-3">
                <div><div className="text-[12.5px] text-ink-subtle">{k}</div><div className="font-medium select-all" dir="ltr">{v}</div></div>
                <span className="flex items-center gap-2"><Mail className="size-4 text-ink-subtle" /><CopyButton value={v} /></span>
              </div>
            ))}
            <div className="card p-5 text-[14px] text-ink-muted"><div className="font-semibold text-ink mb-1">{L('Support hours', 'ساعات الدعم')}</div>{L('Sunday–Thursday, 9:00–18:00 Cairo time, in Arabic and English.', 'الأحد إلى الخميس، ٩:٠٠–١٨:٠٠ بتوقيت القاهرة، بالعربية والإنجليزية.')}</div>
          </aside>
        </div>
      </Section>
    </>
  );
}

/* ---------------- Legal ---------------- */
function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: [string, ReactNode][] }) {
  const { L } = useI18n();
  return (
    <Wrap className="py-14 max-w-[820px]">
      <div className="mb-8 rounded-card border border-warn/30 bg-warn-soft p-4 text-[13.5px]">{L('Draft for legal review — not yet in force.', 'مسودة للمراجعة القانونية — غير سارية بعد.')}</div>
      <h1 className="text-display">{title}</h1>
      <p className="mt-3 text-ink-subtle text-[13px]">{L('Last updated', 'آخر تحديث')} {updated}</p>
      <div className="mt-10 space-y-10">{sections.map(([h, b], i) => <section key={h}><h2 className="font-display text-[20px] font-semibold"><span className="text-ink-subtle tabular me-2">{i + 1}.</span>{h}</h2><div className="mt-3 text-[15.5px] leading-[1.75] text-ink-muted space-y-3">{b}</div></section>)}</div>
    </Wrap>
  );
}

export function Terms() {
  const { L, date } = useI18n();
  return <LegalPage title={L('Terms of service', 'شروط الخدمة')} updated={date(new Date().toISOString(), 'long')} sections={[
    [L('The service', 'الخدمة'), <p key="1">{L('Fatura provides software to prepare, sign, submit and manage e-invoices and e-receipts with the Egyptian Tax Authority (ETA). You remain the issuer of every document and responsible for its contents.', 'تقدم فاتورة برنامجاً لإعداد وتوقيع وإرسال وإدارة الفواتير والإيصالات الإلكترونية. تظل أنت المُصدر والمسؤول عن محتوى كل مستند.')}</p>],
    [L('Your account and credentials', 'حسابك وبياناتك'), <p key="2">{L('You keep your ETA client credentials and signing certificate secure and authorise Fatura to use the credentials only to act on your instructions.', 'تحافظ على بيانات الربط وشهادة التوقيع وتفوض فاتورة باستخدامها لتنفيذ تعليماتك فقط.')}</p>],
    [L('Plans, billing and installments', 'الباقات والفوترة والأقساط'), <p key="3">{L('Plans are billed monthly, yearly, as a yearly licence in installments, or as a one-time licence. Installment plans are interest-free; a missed installment may pause submission after notice, while viewing and export remain available.', 'تُدفع الباقات شهرياً أو سنوياً أو بالتقسيط أو مرة واحدة. الأقساط دون فوائد، والتأخر قد يوقف الإرسال بعد إشعار مع بقاء العرض والتصدير.')}</p>],
    [L('Records', 'السجلات'), <p key="4">{L('We retain submitted documents for at least five years and let you export them at any time, including after cancellation.', 'نحتفظ بالمستندات خمس سنوات على الأقل ويمكنك تصديرها في أي وقت حتى بعد الإلغاء.')}</p>],
    [L('Liability', 'المسؤولية'), <p key="5">{L('Fatura is not tax advice. Our liability is limited to the fees paid in the twelve months before a claim, except where the law does not allow a limit.', 'فاتورة ليست استشارة ضريبية. تقتصر مسؤوليتنا على الرسوم المدفوعة في الاثني عشر شهراً السابقة إلا حيث يمنع القانون ذلك.')}</p>],
    [L('Governing law', 'القانون الحاكم'), <p key="6">{L('These terms are governed by the laws of the Arab Republic of Egypt, with disputes heard by the competent courts of Cairo.', 'تخضع هذه الشروط لقوانين جمهورية مصر العربية وتختص محاكم القاهرة.')}</p>],
  ]} />;
}

export function Privacy() {
  const { L, date } = useI18n();
  return <LegalPage title={L('Privacy policy', 'سياسة الخصوصية')} updated={date(new Date().toISOString(), 'long')} sections={[
    [L('What we collect', 'ما نجمعه'), <p key="1">{L('Account details, company and tax registration data, the documents you create and their ETA results, and usage logs needed to run and secure the service.', 'بيانات الحساب والشركة والتسجيل الضريبي والمستندات ونتائجها وسجلات الاستخدام اللازمة للخدمة وأمانها.')}</p>],
    [L('Why we use it', 'لماذا نستخدمها'), <p key="2">{L('To provide the service, to submit documents to ETA on your instruction, to bill you, and to meet legal record-keeping duties.', 'لتقديم الخدمة وإرسال المستندات بتعليماتك والفوترة والوفاء بواجبات الحفظ القانونية.')}</p>],
    [L('Personal Data Protection Law', 'قانون حماية البيانات الشخصية'), <p key="3">{L('We process personal data in line with Egypt’s Personal Data Protection Law No. 151 of 2020 and its executive regulations, as a processor for the data in your documents and as a controller for your account data.', 'نعالج البيانات وفق قانون حماية البيانات الشخصية رقم ١٥١ لسنة ٢٠٢٠ ولائحته، كمعالج لبيانات مستنداتك وكمتحكم في بيانات حسابك.')}</p>],
    [L('Sharing', 'المشاركة'), <p key="4">{L('We share document data with ETA when you submit, and with sub-processors that host and operate the service under contract. We do not sell data.', 'نشارك البيانات مع المصلحة عند الإرسال ومع مزودي الاستضافة بموجب عقود. لا نبيع البيانات.')}</p>],
    [L('Your rights', 'حقوقك'), <p key="5">{L('You can access, correct, export or ask us to delete personal data, subject to tax record-keeping obligations. Write to privacy@fatura.eg.', 'يمكنك الاطلاع والتصحيح والتصدير وطلب الحذف وفق التزامات حفظ السجلات. راسل privacy@fatura.eg.')}</p>],
  ]} />;
}
