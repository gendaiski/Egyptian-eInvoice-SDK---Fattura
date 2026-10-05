import { Check, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { bi } from '@/i18n';
import { uid } from '@/store/model';
import { priceFor, type Billing } from '@/billing/plans';
import { useI18n } from '@/i18n';
import { useAuth, useStore } from '@/store/store';
import { ApiError } from '@/lib/api';
import { SHOW_DEMO_LOGINS } from '@/env';
import { Logo } from '@/components/brand';
import { Button, Callout, Field, Input } from '@/components/ui';
import { Prefs } from '@/layouts/Shell';

function AuthFrame({ children }: { children: ReactNode }) {
  const { L } = useI18n();
  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-4 sm:px-10 py-6">
        <div className="flex items-center justify-between"><Link to="/"><Logo /></Link><div className="flex"><Prefs /></div></div>
        <div className="flex-1 grid place-items-center py-10"><div className="w-full max-w-[400px] animate-in">{children}</div></div>
      </div>
      <aside className="hidden lg:flex flex-col justify-end bg-accent text-accent-on p-12 relative overflow-hidden">
        <svg className="absolute -top-24 -end-24 opacity-[.08]" width="520" height="520" viewBox="0 0 32 32" aria-hidden><path d="M10 8h12v3.2h-8.4v3.4h7.2v3.2h-7.2V24H10z" fill="currentColor" /></svg>
        <div className="relative max-w-[440px]">
          <p className="text-[26px] leading-snug font-semibold tracking-[-0.02em]">{L('Every ETA document, checked before you sign.', 'كل مستند يُفحص قبل التوقيع.')}</p>
          <ul className="mt-6 space-y-2.5 text-[14.5px] opacity-90">
            {[L('Invoices, credit & debit notes, export invoices', 'فواتير وإشعارات وفواتير تصدير'), L('One payment, recurring or installments', 'دفعة واحدة أو متكررة أو أقساط'), L('Received-documents inbox with reject & decline', 'صندوق المستندات الواردة'), L('Arabic and English, side by side', 'بالعربية والإنجليزية')].map((t) => <li key={t} className="flex gap-2.5"><Check className="size-5 shrink-0" />{t}</li>)}
          </ul>
        </div>
      </aside>
    </div>
  );
}

export function SignIn() {
  const auth = useAuth();
  const { L } = useI18n();
  const nav = useNavigate();
  const api = auth.mode === 'api';
  const [email, setEmail] = useState(api ? '' : 'yasmine@lawtechlabs.eg');
  const [pw, setPw] = useState('');
  const [step, setStep] = useState<'creds' | 'otp'>('creds');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (api) {
      setBusy(true);
      try {
        const db = await auth.login(email, pw);
        const s = db.session;
        nav(s.staffRole && !s.tenantId ? '/admin' : !s.onboarded ? '/onboarding' : '/app');
      } catch (err) { setError(err instanceof ApiError ? err.message : L('Sign-in failed.', 'تعذر تسجيل الدخول.')); }
      finally { setBusy(false); }
      return;
    }
    setBusy(true); await new Promise((r) => setTimeout(r, 500)); setBusy(false);
    if (step === 'creds') { setStep('otp'); return; }
    await auth.login(email, pw);
    nav('/app');
  };
  return (
    <AuthFrame>
      <h1 className="text-[26px] font-semibold">{step === 'creds' ? L('Sign in to Fatura', 'تسجيل الدخول إلى فاتورة') : L('Two-step verification', 'التحقق بخطوتين')}</h1>
      <p className="mt-1 text-ink-muted">{step === 'creds' ? L('Welcome back.', 'مرحباً بعودتك.') : L(`Enter the 6-digit code sent to ${email}.`, `أدخل الرمز المكون من ٦ أرقام المرسل إلى ${email}.`)}</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {step === 'creds' ? (
          <>
            <Field label={L('Work email', 'البريد')}>{(id) => <Input id={id} type="email" dir="ltr" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
            <Field label={L('Password', 'كلمة المرور')}>{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={api ? undefined : L('Any password works in the demo', 'أي كلمة مرور تعمل في العرض')} required={api} />}</Field>
          </>
        ) : (
          <Field label={L('Verification code', 'رمز التحقق')} hint={L('Demo: any 6 digits.', 'العرض: أي ٦ أرقام.')}>{(id) => <Input id={id} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tracking-[.4em] text-center text-[18px] font-mono" autoFocus />}</Field>
        )}
        {error && <Callout tone="bad">{error}</Callout>}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={step === 'otp' && otp.length !== 6}>{step === 'creds' ? L('Continue', 'متابعة') : L('Verify and sign in', 'تحقق وادخل')}</Button>
      </form>
      <p className="mt-6 text-[13.5px] text-ink-muted">{L('New to Fatura?', 'جديد على فاتورة؟')} <Link to="/signup" className="link font-medium">{L('Create an account', 'أنشئ حساباً')}</Link></p>
      {api && SHOW_DEMO_LOGINS && (
        <div className="mt-6"><Callout tone="info" title={L('Test workspace logins', 'حسابات الاختبار')}>
          <div className="space-y-1.5 mt-1" dir="ltr">
            {[['demo@fatura.eg', 'fatura-demo-2026', L('Tenant owner', 'مالك الحساب')], ['admin@fatura.eg', 'fatura-admin-2026', L('Platform admin', 'مدير المنصة')]].map(([e, p, r]) => (
              <button key={e} type="button" className="block text-start w-full hover:underline" onClick={() => { setEmail(e); setPw(p); }}><span className="font-mono text-[12.5px]">{e} / {p}</span> <span className="text-ink-subtle text-[12px]">· {r}</span></button>
            ))}
          </div>
        </Callout></div>
      )}
      <div className="mt-8"><Callout tone="info" icon={<ShieldCheck className="size-[18px]" />}>{L('Fatura staff use the same sign-in, then open the admin panel from the user menu.', 'يستخدم موظفو فاتورة نفس الدخول ثم يفتحون لوحة الإدارة من قائمة المستخدم.')}</Callout></div>
    </AuthFrame>
  );
}

export function SignUp() {
  const { db } = useStore();
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { L, lang, money } = useI18n();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const plan = db.admin.plans.find((p) => p.id === params.get('plan')) ?? db.admin.plans.find((p) => p.featured) ?? db.admin.plans[0];
  const billing = (['monthly', 'yearly', 'installments', 'one-time'].includes(params.get('billing') ?? '') ? params.get('billing') : 'monthly') as Billing;
  const [price, en, ar] = priceFor(plan, billing);
  const [f, setF] = useState({ name: '', company: '', email: '', pw: '' });
  const [agree, setAgree] = useState(false);
  const ok = f.name && f.company && /^\S+@\S+\.\S+$/.test(f.email) && f.pw.length >= 8 && agree;
  return (
    <AuthFrame>
      <h1 className="text-[26px] font-semibold">{L('Start your free trial', 'ابدأ تجربتك المجانية')}</h1>
      <p className="mt-1 text-ink-muted">{L('14 days on ETA pre-production. No card needed.', '١٤ يوماً على بيئة الاختبار. بدون بطاقة.')}</p>
      <div className="mt-6 flex items-center justify-between gap-3 rounded-card border border-accent/25 bg-accent-soft/50 p-4">
        <div>
          <div className="text-[12px] text-ink-subtle">{L('Your plan after the trial', 'باقتك بعد التجربة')}</div>
          <div className="font-semibold text-ink">{bi(lang, { en: plan.name, ar: plan.nameAr })} · <span className="tabular">{money(price)}</span> <span className="text-ink-muted font-normal">{L(en, ar)}</span></div>
          <div className="text-[12px] text-ink-muted">{{ monthly: L('Billed monthly', 'شهري'), yearly: L('Billed yearly', 'سنوي'), installments: L(`Yearly licence in ${plan.installments.count} installments`, `ترخيص سنوي على ${plan.installments.count} أقساط`), 'one-time': L('One-time licence', 'ترخيص دائم') }[billing]}</div>
        </div>
        <Link to="/pricing" className="text-[13px] link shrink-0">{L('Change', 'تغيير')}</Link>
      </div>
      <form className="mt-6 space-y-4" onSubmit={async (e) => {
        e.preventDefault(); if (!ok) return;
        const tid = uid('t');
        setBusy(true); setError('');
        try { await auth.signup({ name: f.name, company: f.company, email: f.email, password: f.pw, plan: plan.id, billing }, (x) => {
          x.session = { signedIn: true, onboarded: false, user: { name: f.name, email: f.email }, tenantId: tid };
          x.company.name = f.company;
          x.admin.tenants.unshift({ id: tid, name: f.company, rin: '—', owner: f.email, governorate: 'Cairo', planId: plan.id, model: billing === 'monthly' || billing === 'yearly' ? 'recurring' : billing, cycle: billing === 'monthly' || billing === 'yearly' ? billing : undefined, status: 'trial', env: 'preprod', docsThisMonth: 0, invalidRate: 0, signer: 'offline', mrr: 0, createdAt: new Date().toISOString(), installmentsPaid: billing === 'installments' ? 0 : undefined });
          x.admin.leads.unshift({ id: uid('l'), at: new Date().toISOString(), name: f.name, email: f.email, company: f.company, topic: 'sales', message: `Started a trial on ${plan.name} (${billing}).`, source: 'signup', planId: plan.id, billing, status: 'new' });
        }); }
        catch (err) { setError(err instanceof ApiError ? err.message : L('Could not create the account.', 'تعذر إنشاء الحساب.')); setBusy(false); return; }
        setBusy(false);
        nav('/onboarding');
      }}>
        <Field label={L('Your name', 'اسمك')}>{(id) => <Input id={id} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label={L('Company legal name', 'الاسم القانوني للشركة')}>{(id) => <Input id={id} autoComplete="organization" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />}</Field>
        <Field label={L('Work email', 'البريد')}>{(id) => <Input id={id} type="email" dir="ltr" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label={L('Password', 'كلمة المرور')} hint={L('At least 8 characters.', '٨ أحرف على الأقل.')}>{(id) => <Input id={id} type="password" autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} />}</Field>
        <label className="flex items-start gap-2.5 text-[13px] text-ink-muted"><input type="checkbox" className="mt-0.5 size-4 accent-[rgb(var(--accent))]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{L('I agree to the terms and the data processing agreement.', 'أوافق على الشروط واتفاقية معالجة البيانات.')}</label>
        {error && <Callout tone="bad">{error}</Callout>}
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!ok} loading={busy}>{L('Create account', 'إنشاء الحساب')}</Button>
      </form>
      <p className="mt-6 text-[13.5px] text-ink-muted">{L('Already have an account?', 'لديك حساب؟')} <Link to="/signin" className="link font-medium">{L('Sign in', 'تسجيل الدخول')}</Link></p>
    </AuthFrame>
  );
}
