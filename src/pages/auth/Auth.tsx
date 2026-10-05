import { Check, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
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
  const { set } = useStore();
  const { L } = useI18n();
  const nav = useNavigate();
  const [email, setEmail] = useState('yasmine@lawtechlabs.eg');
  const [pw, setPw] = useState('');
  const [step, setStep] = useState<'creds' | 'otp'>('creds');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); await new Promise((r) => setTimeout(r, 500)); setBusy(false);
    if (step === 'creds') { setStep('otp'); return; }
    set((x) => { x.session.signedIn = true; x.session.onboarded = true; });
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
            <Field label={L('Password', 'كلمة المرور')}>{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={L('Any password works in the demo', 'أي كلمة مرور تعمل في العرض')} />}</Field>
          </>
        ) : (
          <Field label={L('Verification code', 'رمز التحقق')} hint={L('Demo: any 6 digits.', 'العرض: أي ٦ أرقام.')}>{(id) => <Input id={id} dir="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="tracking-[.4em] text-center text-[18px] font-mono" autoFocus />}</Field>
        )}
        <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={step === 'otp' && otp.length !== 6}>{step === 'creds' ? L('Continue', 'متابعة') : L('Verify and sign in', 'تحقق وادخل')}</Button>
      </form>
      <p className="mt-6 text-[13.5px] text-ink-muted">{L('New to Fatura?', 'جديد على فاتورة؟')} <Link to="/signup" className="link font-medium">{L('Create an account', 'أنشئ حساباً')}</Link></p>
      <div className="mt-8"><Callout tone="info" icon={<ShieldCheck className="size-[18px]" />}>{L('Fatura staff use the same sign-in, then open the admin panel from the user menu.', 'يستخدم موظفو فاتورة نفس الدخول ثم يفتحون لوحة الإدارة من قائمة المستخدم.')}</Callout></div>
    </AuthFrame>
  );
}

export function SignUp() {
  const { set } = useStore();
  const { L } = useI18n();
  const nav = useNavigate();
  const [f, setF] = useState({ name: '', company: '', email: '', pw: '' });
  const [agree, setAgree] = useState(false);
  const ok = f.name && f.company && /^\S+@\S+\.\S+$/.test(f.email) && f.pw.length >= 8 && agree;
  return (
    <AuthFrame>
      <h1 className="text-[26px] font-semibold">{L('Start your free trial', 'ابدأ تجربتك المجانية')}</h1>
      <p className="mt-1 text-ink-muted">{L('14 days on ETA pre-production. No card needed.', '١٤ يوماً على بيئة الاختبار. بدون بطاقة.')}</p>
      <form className="mt-8 space-y-4" onSubmit={(e) => { e.preventDefault(); if (!ok) return; set((x) => { x.session = { signedIn: true, onboarded: false, user: { name: f.name, email: f.email } }; x.company.name = f.company; }); nav('/onboarding'); }}>
        <Field label={L('Your name', 'اسمك')}>{(id) => <Input id={id} autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />}</Field>
        <Field label={L('Company legal name', 'الاسم القانوني للشركة')}>{(id) => <Input id={id} autoComplete="organization" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />}</Field>
        <Field label={L('Work email', 'البريد')}>{(id) => <Input id={id} type="email" dir="ltr" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />}</Field>
        <Field label={L('Password', 'كلمة المرور')} hint={L('At least 8 characters.', '٨ أحرف على الأقل.')}>{(id) => <Input id={id} type="password" autoComplete="new-password" value={f.pw} onChange={(e) => setF({ ...f, pw: e.target.value })} />}</Field>
        <label className="flex items-start gap-2.5 text-[13px] text-ink-muted"><input type="checkbox" className="mt-0.5 size-4 accent-[rgb(var(--accent))]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />{L('I agree to the terms and the data processing agreement.', 'أوافق على الشروط واتفاقية معالجة البيانات.')}</label>
        <Button type="submit" variant="primary" size="lg" className="w-full" disabled={!ok}>{L('Create account', 'إنشاء الحساب')}</Button>
      </form>
      <p className="mt-6 text-[13.5px] text-ink-muted">{L('Already have an account?', 'لديك حساب؟')} <Link to="/signin" className="link font-medium">{L('Sign in', 'تسجيل الدخول')}</Link></p>
    </AuthFrame>
  );
}
