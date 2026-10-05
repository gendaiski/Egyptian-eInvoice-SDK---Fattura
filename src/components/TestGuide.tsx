/**
 * Guided test scenarios for the self-contained preview build (VITE_ROUTER=memory, local data).
 * A non-modal panel so testers can follow the steps while using the app; results stay in this browser.
 */
import { ArrowUpRight, Check, ChevronDown, ChevronUp, FlaskConical, RotateCcw, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Badge, Button, Progress, cx } from './ui';

type T = { en: string; ar: string };
interface Scenario { id: string; group: 'site' | 'app' | 'pay' | 'admin' | 'quality'; title: T; route: string; steps: T[]; expect: T }

const t = (en: string, ar: string): T => ({ en, ar });

const SCENARIOS: Scenario[] = [
  { id: 'signup', group: 'site', route: '/pricing', title: t('Pricing → sign-up → onboarding', 'الأسعار ← التسجيل ← الإعداد'),
    steps: [t('Pick a plan and a billing model (try Installments), then “Start with …”.', 'اختر باقة وطريقة دفع (جرّب الأقساط) ثم «ابدأ».'),
      t('Fill the sign-up form and create the account.', 'املأ نموذج التسجيل وأنشئ الحساب.'),
      t('Onboarding: enter any 9-digit RIN → Verify; add the head-office address; enter any client ID and secret → Test connection; Detect signer.', 'الإعداد: أدخل أي رقم تسجيل من ٩ أرقام ← تحقق؛ أضف العنوان؛ أدخل أي معرّف وسر ← اختبار الاتصال؛ اكتشاف التوقيع.')],
    expect: t('You land on the dashboard. Admin → Tenants and Admin → Leads both show the new company with the plan you picked.', 'تصل للوحة التحكم، وتظهر الشركة الجديدة في المشتركين والعملاء المحتملين بلوحة الإدارة.') },
  { id: 'contact', group: 'site', route: '/contact', title: t('Contact form → admin leads', 'نموذج التواصل ← العملاء المحتملون'),
    steps: [t('Send a demo request from the contact page.', 'أرسل طلب عرض من صفحة التواصل.'), t('Open Admin → Leads and change its status.', 'افتح الإدارة ← العملاء المحتملون وغيّر الحالة.')],
    expect: t('The request appears at the top of Leads with source “Contact form”.', 'يظهر الطلب أعلى القائمة بمصدر «نموذج التواصل».') },
  { id: 'signin', group: 'site', route: '/signin', title: t('Sign in with two-step code', 'الدخول بالتحقق بخطوتين'),
    steps: [t('Any password, then any 6 digits as the code.', 'أي كلمة مرور ثم أي ٦ أرقام كرمز.')],
    expect: t('You reach the taxpayer dashboard.', 'تصل للوحة تحكم الممول.') },
  { id: 'invoice', group: 'app', route: '/app/documents/new', title: t('Issue an invoice (one payment)', 'إصدار فاتورة (دفعة واحدة)'),
    steps: [t('Choose a customer in “Bill to” and an item on line 1; change the quantity.', 'اختر عميلاً في «إلى» وصنفاً في السطر الأول وغيّر الكمية.'),
      t('Watch VAT (T1) and totals update in the summary, then Submit.', 'تابع تحديث ضريبة القيمة المضافة والإجمالي ثم «إرسال».')],
    expect: t('Status moves Signing → Submitted → Valid within a few seconds; the detail page shows the ETA UUID, QR code and all validation steps green.', 'تتغير الحالة: توقيع ← مرسل ← صالح خلال ثوانٍ، مع رقم UUID ورمز QR وخطوات تحقق ناجحة.') },
  { id: 'invalid', group: 'app', route: '/app/items', title: t('Invalid document and correction', 'مستند غير صالح وتصحيحه'),
    steps: [t('Items & codes → New item (EGS). Its code status is Submitted, not yet approved by ETA.', 'الأصناف ← صنف جديد (EGS). حالة الكود «مُرسل» ولم تعتمده المصلحة بعد.'),
      t('Invoice that item and submit it.', 'أصدر فاتورة بهذا الصنف وأرسلها.'),
      t('On the Invalid document, read the validation result, then “Correct & resubmit”.', 'في المستند غير الصالح اقرأ نتيجة التحقق ثم «تصحيح وإعادة الإرسال».')],
    expect: t('ETA returns Invalid with “Code validator · ItemCodeNotActive”; the correction opens a new draft copy with a new number.', 'ترد المصلحة «غير صالح» بخطأ مدقق الأكواد، ويفتح التصحيح مسودة جديدة برقم جديد.') },
  { id: 'preflight', group: 'app', route: '/app/documents/new', title: t('Pre-flight checks block bad data', 'الفحص المسبق يمنع البيانات الخاطئة'),
    steps: [t('Composer → New customer: business type, tax ID ending in 000 → Verify.', 'الإنشاء ← عميل جديد: شركة برقم ضريبي ينتهي بـ 000 ← تحقق.'),
      t('Try to submit with an empty line or a missing customer.', 'حاول الإرسال بسطر فارغ أو بدون عميل.')],
    expect: t('The lookup says the taxpayer is not registered; Submit lists the issues and nothing is sent to ETA.', 'يفيد البحث بأن الممول غير مسجل، ويعرض الإرسال المشكلات دون إرسال أي شيء.') },
  { id: 'cancel', group: 'app', route: '/app/documents', title: t('Cancel a valid invoice', 'إلغاء فاتورة صالحة'),
    steps: [t('Issue an invoice (or open one validated today). In the “Cancellation window” card → Cancel document, give a reason.', 'أصدر فاتورة (أو افتح فاتورة اعتُمدت اليوم). في بطاقة «مهلة الإلغاء» ← إلغاء المستند مع ذكر السبب.')],
    expect: t('The card shows the time left in ETA’s window; afterwards the status is Cancelled and the lifecycle records the reason.', 'تظهر مهلة الإلغاء المتبقية، ثم تصبح الحالة «ملغي» ويُسجل السبب.') },
  { id: 'credit', group: 'app', route: '/app/documents/new?type=C', title: t('Credit note against an invoice', 'إشعار دائن لفاتورة'),
    steps: [t('Pick the customer and the original invoice, add a line, submit.', 'اختر العميل والفاتورة الأصلية وأضف سطراً ثم أرسل.')],
    expect: t('The note becomes Valid and appears under “Related” on the original invoice.', 'يصبح الإشعار صالحاً ويظهر ضمن «مرتبط» في الفاتورة الأصلية.') },
  { id: 'received', group: 'app', route: '/app/received', title: t('Received documents: reject and decline', 'المستندات الواردة: رفض ورفض الإلغاء'),
    steps: [t('Tab “Needs action”: reject a supplier invoice with a reason.', 'تبويب «يحتاج إجراء»: ارفض فاتورة مورد مع السبب.'),
      t('For a supplier cancellation request, choose Accept or Decline.', 'لطلب إلغاء من مورد اختر قبول أو رفض.')],
    expect: t('Statuses update and input VAT recalculates at the top.', 'تتحدث الحالات ويُعاد حساب ضريبة المدخلات.') },
  { id: 'installments', group: 'pay', route: '/app/documents/new', title: t('Installment invoice and payments', 'فاتورة بالتقسيط والدفعات'),
    steps: [t('Composer → payment: Installments, 20 % down payment, 3 installments → Submit.', 'الإنشاء ← الدفع: أقساط، دفعة مقدمة ٢٠٪، ٣ أقساط ← إرسال.'),
      t('On the Valid invoice → Record payment for the down payment.', 'في الفاتورة الصالحة ← تسجيل دفعة للمقدم.'),
      t('Open Payments & installments.', 'افتح المدفوعات والأقساط.')],
    expect: t('ETA gets one invoice for the full amount; Fatura tracks the schedule, the paid down payment and the next due installment.', 'تستلم المصلحة فاتورة واحدة بكامل المبلغ، وتتابع فاتورة الجدول والمقدم المدفوع والقسط التالي.') },
  { id: 'recurring', group: 'pay', route: '/app/recurring', title: t('Recurring invoices', 'الفواتير المتكررة'),
    steps: [t('Open a schedule: check upcoming runs, Pause / Resume.', 'افتح جدولاً: راجع الإصدارات القادمة، إيقاف / استئناف.'),
      t('“Issue one now”.', '«إصدار واحدة الآن».')],
    expect: t('A new draft invoice is generated from the schedule and opened for review.', 'تُنشأ مسودة فاتورة من الجدول وتُفتح للمراجعة.') },
  { id: 'reports', group: 'pay', route: '/app/reports', title: t('Receivables and VAT report', 'المستحقات وتقرير الضريبة'),
    steps: [t('Payments & installments: aged receivables buckets.', 'المدفوعات والأقساط: أعمار الديون.'), t('Tax reports: monthly output vs input VAT.', 'التقارير الضريبية: ضريبة المخرجات والمدخلات شهرياً.')],
    expect: t('Figures match the invoices and payments you created.', 'الأرقام تطابق الفواتير والدفعات التي أنشأتها.') },
  { id: 'signer', group: 'app', route: '/app/settings/signing', title: t('Signer offline blocks submission', 'انقطاع التوقيع يمنع الإرسال'),
    steps: [t('Settings → Signing → Simulate disconnect.', 'الإعدادات ← التوقيع ← محاكاة الانقطاع.'), t('Open the composer, then reconnect.', 'افتح الإنشاء ثم أعد الاتصال.')],
    expect: t('The header pill turns red and Submit is disabled with an explanation; drafts can still be saved.', 'يتحول المؤشر للأحمر ويتعطل الإرسال مع توضيح، ويبقى حفظ المسودة متاحاً.') },
  { id: 'eta', group: 'app', route: '/app/settings/integration', title: t('ETA connection test', 'اختبار الربط مع المصلحة'),
    steps: [t('Test connection; switch environment to production and back.', 'اختبر الاتصال؛ حوّل البيئة للإنتاج ثم ارجع.')],
    expect: t('Token issued and document types listed; the environment pill in the header follows the switch.', 'يصدر الرمز وتظهر أنواع المستندات، ويتغير مؤشر البيئة في الأعلى.') },
  { id: 'plans', group: 'admin', route: '/admin/plans', title: t('Admin pricing drives the website', 'أسعار الإدارة تظهر في الموقع'),
    steps: [t('Edit a plan’s monthly price → Save plan.', 'عدّل السعر الشهري لباقة ← حفظ.'), t('“View pricing page”.', '«عرض صفحة الأسعار».')],
    expect: t('The public pricing page shows the new price.', 'تعرض صفحة الأسعار السعر الجديد.') },
  { id: 'banner', group: 'admin', route: '/admin/settings', title: t('Website announcement bar', 'شريط إعلان الموقع'),
    steps: [t('Turn the website announcement on and edit the text.', 'فعّل إعلان الموقع وعدّل النص.'), t('View website.', 'اعرض الموقع.')],
    expect: t('The bar appears on every public page.', 'يظهر الشريط في كل صفحات الموقع.') },
  { id: 'tenants', group: 'admin', route: '/admin/tenants', title: t('Tenants, billing and support', 'المشتركون والفوترة والدعم'),
    steps: [t('Open a tenant: change plan, Suspend / Reactivate.', 'افتح مشتركاً: غيّر الباقة، إيقاف / إعادة تفعيل.'), t('Billing & collections: Mark paid, Remind.', 'الفوترة والتحصيل: تحديد كمدفوع، تذكير.')],
    expect: t('Status badges and the overview’s “Needs attention” list update.', 'تتحدث الشارات وقائمة «يحتاج انتباه».') },
  { id: 'rtl', group: 'quality', route: '/app', title: t('Arabic, RTL and dark mode', 'العربية والاتجاه والوضع الداكن'),
    steps: [t('Switch to العربية and dark mode from the header; visit a few pages and the composer.', 'بدّل للعربية والوضع الداكن من الأعلى وتصفح عدة صفحات.')],
    expect: t('Layout mirrors, numbers and dates are localized, nothing overlaps.', 'ينعكس التخطيط وتُعرض الأرقام والتواريخ محلياً دون تداخل.') },
  { id: 'mobile', group: 'quality', route: '/', title: t('Phone width', 'عرض الهاتف'),
    steps: [t('Narrow the window to about 380 px; open the menu, the composer and a document.', 'صغّر النافذة لنحو ٣٨٠ بكسل وافتح القائمة والإنشاء ومستنداً.')],
    expect: t('No sideways scrolling; tables scroll inside their cards.', 'لا تمرير أفقي للصفحة؛ الجداول تُمرر داخل بطاقاتها.') },
  { id: 'developers', group: 'quality', route: '/developers', title: t('ETA payload and signed string', 'حمولة المصلحة والنص الموقّع'),
    steps: [t('Developers page: change values in the sample and watch the JSON and canonical string.', 'صفحة المطورين: غيّر القيم وتابع JSON والنص المعياري.')],
    expect: t('The payload follows ETA v1.0 field names; the canonical string updates live.', 'تتبع الحمولة أسماء حقول الإصدار 1.0 ويتحدث النص فوراً.') },
];

const GROUPS: { id: Scenario['group']; label: T }[] = [
  { id: 'site', label: t('Website & accounts', 'الموقع والحسابات') },
  { id: 'app', label: t('Invoicing & ETA', 'الفوترة والمصلحة') },
  { id: 'pay', label: t('Getting paid', 'التحصيل') },
  { id: 'admin', label: t('Admin panel', 'لوحة الإدارة') },
  { id: 'quality', label: t('Language, theme & layout', 'اللغة والمظهر والتخطيط') },
];

type Result = 'pass' | 'fail';
const KEY = 'fatura.testguide';
const load = (): Record<string, Result> => { try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch { return {}; } };
const save = (r: Record<string, Result>) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* storage blocked */ } };

export function TestGuide() {
  const { L, lang } = useI18n();
  const { reset } = useStore();
  const nav = useNavigate();
  // Clear of the app/admin sidebar; on the website, keep it away from the hero copy.
  const place = /^\/(app|admin)(\/|$)/.test(useLocation().pathname) ? 'start-4 lg:start-[264px]' : 'end-4';
  // full: the scenario list; bar: one line for the scenario being tested, so the app stays usable; closed: a pill.
  const [mode, setMode] = useState<'full' | 'bar' | 'closed'>('full');
  const [expanded, setExpanded] = useState<string | null>('invoice');
  const [results, setResults] = useState<Record<string, Result>>(load);
  const [confirmReset, setConfirmReset] = useState(false);
  const mark = (id: string, r: Result) => setResults((prev) => { const next = { ...prev }; if (next[id] === r) delete next[id]; else next[id] = r; save(next); return next; });
  const done = Object.keys(results).length;
  const failed = Object.values(results).filter((r) => r === 'fail').length;

  const current = SCENARIOS.find((s) => s.id === expanded);
  if (mode === 'bar' && current) {
    const r = results[current.id];
    return (
      <div role="region" aria-label={L('Test scenarios', 'سيناريوهات الاختبار')} className={cx('fixed bottom-4 z-40 w-[min(380px,calc(100vw-2rem))] card shadow-pop flex items-center gap-1.5 p-1.5 ps-3', place)}>
        <FlaskConical className="size-4 text-accent shrink-0" />
        <span className="flex-1 min-w-0 truncate text-[13px] font-medium text-ink">{current.title[lang]}</span>
        <button onClick={() => mark(current.id, 'pass')} aria-label={L('Passed', 'نجح')} aria-pressed={r === 'pass'} className={cx('size-8 grid place-items-center rounded', r === 'pass' ? 'bg-ok text-white' : 'hover:bg-sunken text-ok')}><Check className="size-4" /></button>
        <button onClick={() => mark(current.id, 'fail')} aria-label={L('Failed', 'فشل')} aria-pressed={r === 'fail'} className={cx('size-8 grid place-items-center rounded', r === 'fail' ? 'bg-bad text-white' : 'hover:bg-sunken text-bad')}><X className="size-4" /></button>
        <button onClick={() => setMode('full')} aria-label={L('Show steps', 'عرض الخطوات')} className="size-8 grid place-items-center rounded hover:bg-sunken"><ChevronUp className="size-4" /></button>
      </div>
    );
  }
  if (mode === 'closed') {
    return (
      <button onClick={() => setMode('full')} className={cx('fixed bottom-4 z-40 inline-flex items-center gap-2 h-10 px-3.5 rounded-full bg-ink text-canvas shadow-pop text-[13px] font-medium', place)}>
        <FlaskConical className="size-4" />{L('Test scenarios', 'سيناريوهات الاختبار')}<span className="tabular opacity-80">{done}/{SCENARIOS.length}</span>
      </button>
    );
  }
  return (
    <aside aria-label={L('Test scenarios', 'سيناريوهات الاختبار')}
      className={cx('fixed z-40 bottom-4 w-[min(380px,calc(100vw-2rem))] max-h-[min(640px,calc(100vh-2rem))] flex flex-col card shadow-pop overflow-hidden', place)}>
      <header className="p-4 border-b border-line space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 font-semibold text-ink"><FlaskConical className="size-4 text-accent" />{L('Test scenarios', 'سيناريوهات الاختبار')}</div>
            <p className="text-[12.5px] text-ink-muted mt-0.5">{L('Everything runs in this page with a simulated ETA. Mark each scenario as you go.', 'كل شيء يعمل داخل الصفحة بمحاكاة للمصلحة. سجّل نتيجة كل سيناريو.')}</p>
          </div>
          <button onClick={() => setMode('closed')} className="size-8 grid place-items-center rounded hover:bg-sunken shrink-0" aria-label={L('Minimise', 'تصغير')}><ChevronDown className="size-4" /></button>
        </div>
        <div className="flex items-center gap-3">
          <Progress className="flex-1" value={done / SCENARIOS.length} tone={failed ? 'warn' : 'ok'} />
          <span className="text-[12px] tabular text-ink-muted shrink-0">{L(`${done} of ${SCENARIOS.length} tested`, `${done} من ${SCENARIOS.length}`)}{failed ? ` · ${L(`${failed} failed`, `${failed} فشل`)}` : ''}</span>
        </div>
      </header>
      <div className="overflow-y-auto flex-1">
        {GROUPS.map((g) => (
          <section key={g.id}>
            <h3 className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-subtle">{g.label[lang]}</h3>
            <ul>
              {SCENARIOS.filter((s) => s.group === g.id).map((s) => {
                const r = results[s.id];
                const isOpen = expanded === s.id;
                return (
                  <li key={s.id} className="border-b border-line last:border-0">
                    <button onClick={() => setExpanded(isOpen ? null : s.id)} aria-expanded={isOpen} className="w-full flex items-center gap-2.5 px-4 py-2.5 text-start hover:bg-sunken/60">
                      <span className={cx('size-5 rounded-full grid place-items-center shrink-0 border', r === 'pass' ? 'bg-ok border-ok text-white' : r === 'fail' ? 'bg-bad border-bad text-white' : 'border-line')}>
                        {r === 'pass' ? <Check className="size-3" /> : r === 'fail' ? <X className="size-3" /> : null}
                      </span>
                      <span className="flex-1 text-[13.5px] font-medium text-ink">{s.title[lang]}</span>
                      <ChevronDown className={cx('size-4 text-ink-subtle transition-transform', isOpen && 'rotate-180')} />
                    </button>
                    {isOpen && (
                      <div className="px-4 pb-3.5 ps-[46px] space-y-2.5 text-[13px]">
                        <ol className="list-decimal ps-4 space-y-1 text-ink-muted">{s.steps.map((x, i) => <li key={i}>{x[lang]}</li>)}</ol>
                        <p className="rounded-md bg-sunken/70 border border-line px-2.5 py-2 text-ink"><span className="font-medium">{L('Expected: ', 'المتوقع: ')}</span>{s.expect[lang]}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="primary" icon={<ArrowUpRight className="size-4" />} onClick={() => { nav(s.route); setMode('bar'); }}>{L('Go there', 'انتقل')}</Button>
                          <Button size="sm" onClick={() => mark(s.id, 'pass')} icon={<Check className="size-4" />} className={r === 'pass' ? 'ring-1 ring-ok' : ''}>{L('Passed', 'نجح')}</Button>
                          <Button size="sm" onClick={() => mark(s.id, 'fail')} icon={<X className="size-4" />} className={r === 'fail' ? 'ring-1 ring-bad' : ''}>{L('Failed', 'فشل')}</Button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <footer className="p-3 border-t border-line flex flex-wrap items-center justify-between gap-2">
        {confirmReset ? (
          <>
            <span className="text-[12.5px] text-ink-muted">{L('Restore the sample company and clear results?', 'استعادة بيانات العرض ومسح النتائج؟')}</span>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => setConfirmReset(false)}>{L('Keep', 'إبقاء')}</Button>
              <Button size="sm" variant="danger" onClick={() => { reset(); setResults({}); save({}); setConfirmReset(false); nav('/app'); }}>{L('Reset', 'إعادة الضبط')}</Button>
            </div>
          </>
        ) : (
          <>
            <Badge tone="info">{L('Demo data · simulated ETA', 'بيانات عرض · محاكاة')}</Badge>
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" />} onClick={() => setConfirmReset(true)}>{L('Start over', 'البدء من جديد')}</Button>
          </>
        )}
      </footer>
    </aside>
  );
}
