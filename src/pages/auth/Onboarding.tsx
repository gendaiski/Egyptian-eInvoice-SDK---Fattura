import { Building, Check, CheckCircle2, KeyRound, Loader2, MapPin, PartyPopper, Usb } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ACTIVITY_CODES, GOVERNORATES } from '@/eta/codes';
import { mockEta } from '@/eta/mockClient';
import { bi, useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Logo } from '@/components/brand';
import { Button, Callout, Field, Input, Segmented, Select, cx } from '@/components/ui';
import { Prefs } from '@/layouts/Shell';

export function Onboarding() {
  const { db, set } = useStore();
  const { L, lang } = useI18n();
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [co, setCo] = useState({ name: db.company.name, nameAr: db.company.nameAr, rin: '', activity: db.company.activityCode });
  const [rinState, setRinState] = useState<'idle' | 'busy' | 'ok'>('idle');
  const [addr, setAddr] = useState({ ...db.company.branches[0].address });
  const [env, setEnv] = useState<'preprod' | 'production'>('preprod');
  const [cid, setCid] = useState('');
  const [secret, setSecret] = useState('');
  const [conn, setConn] = useState<'idle' | 'busy' | 'ok'>('idle');
  const [signer, setSigner] = useState<'idle' | 'busy' | 'ok'>('idle');

  const steps: { title: string; icon: ReactNode; ok: boolean }[] = [
    { title: L('Company', 'الشركة'), icon: <Building className="size-4" />, ok: !!co.name && rinState === 'ok' },
    { title: L('Head office', 'المقر الرئيسي'), icon: <MapPin className="size-4" />, ok: !!addr.street && !!addr.regionCity && !!addr.buildingNumber },
    { title: L('ETA connection', 'الربط مع المصلحة'), icon: <KeyRound className="size-4" />, ok: conn === 'ok' },
    { title: L('Signing', 'التوقيع'), icon: <Usb className="size-4" />, ok: signer === 'ok' },
  ];
  const finish = () => {
    set((x) => {
      x.company.name = co.name; x.company.nameAr = co.nameAr || co.name; x.company.rin = co.rin; x.company.activityCode = co.activity;
      x.company.branches[0].address = { ...addr, branchID: '0' };
      x.integration = { ...x.integration, env, clientId: cid, secretSet: true, status: 'connected', lastTokenAt: new Date().toISOString() };
      x.signing.agent = { ...x.signing.agent, status: 'online', lastSeen: new Date().toISOString() };
      x.session.onboarded = true;
    });
    nav('/app');
  };

  return (
    <div className="min-h-screen">
      <header className="h-16 border-b border-line bg-surface"><div className="max-w-[960px] mx-auto px-4 h-full flex items-center justify-between"><Logo /><div className="flex"><Prefs /></div></div></header>
      <main className="max-w-[960px] mx-auto px-4 py-10 grid gap-8 md:grid-cols-[220px_minmax(0,1fr)]">
        <ol className="space-y-1" aria-label={L('Setup steps', 'خطوات الإعداد')}>
          {steps.map((s, i) => (
            <li key={i}>
              <button disabled={i > step && !steps.slice(0, i).every((x) => x.ok)} onClick={() => setStep(i)}
                className={cx('w-full flex items-center gap-3 h-11 px-3 rounded-md text-start text-[13.5px] font-medium disabled:opacity-50', i === step ? 'bg-surface border border-line shadow-card text-ink' : 'text-ink-muted hover:text-ink')}>
                <span className={cx('size-6 rounded-full grid place-items-center border shrink-0', s.ok ? 'bg-ok border-ok text-white' : i === step ? 'border-accent text-accent' : 'border-line')}>{s.ok ? <Check className="size-3.5" /> : s.icon}</span>
                {s.title}
              </button>
            </li>
          ))}
        </ol>
        <section className="card p-6 sm:p-8 animate-in" key={step}>
          {step === 0 && (
            <div className="space-y-5">
              <div><h1 className="text-[22px] font-semibold">{L('Tell us about your company', 'عرّفنا بشركتك')}</h1><p className="text-ink-muted mt-1">{L('This becomes the issuer on every ETA document.', 'هذه البيانات تظهر كمُصدر على كل مستند.')}</p></div>
              <Field label={L('Tax registration number (RIN)', 'رقم التسجيل الضريبي')} hint={rinState === 'ok' ? <span className="text-ok">{L('Found in the ETA registry — active VAT registrant.', 'موجود في سجل المصلحة — مسجل نشط.')}</span> : L('9 digits, from your tax card.', '٩ أرقام من البطاقة الضريبية.')}>
                {(id) => <div className="flex gap-2"><Input id={id} dir="ltr" inputMode="numeric" maxLength={9} value={co.rin} onChange={(e) => { setRinState('idle'); setCo({ ...co, rin: e.target.value.replace(/\D/g, '') }); }} className="font-mono" />
                  <Button disabled={co.rin.length !== 9} loading={rinState === 'busy'} onClick={async () => { setRinState('busy'); await new Promise((r) => setTimeout(r, 700)); setRinState('ok'); }}>{L('Verify', 'تحقق')}</Button></div>}
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={L('Legal name (English)', 'الاسم بالإنجليزية')}>{(id) => <Input id={id} value={co.name} onChange={(e) => setCo({ ...co, name: e.target.value })} />}</Field>
                <Field label={L('Legal name (Arabic)', 'الاسم بالعربية')}>{(id) => <Input id={id} dir="rtl" value={co.nameAr} onChange={(e) => setCo({ ...co, nameAr: e.target.value })} />}</Field>
              </div>
              <Field label={L('Main activity code', 'كود النشاط الرئيسي')}>{(id) => <Select id={id} value={co.activity} onChange={(e) => setCo({ ...co, activity: e.target.value })}>{ACTIVITY_CODES.map((a) => <option key={a.code} value={a.code}>{a.code} · {bi(lang, a)}</option>)}</Select>}</Field>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <div><h1 className="text-[22px] font-semibold">{L('Head office address', 'عنوان المقر الرئيسي')}</h1><p className="text-ink-muted mt-1">{L('Must match your ETA registration. It is sent as branch 0. You can add more branches later.', 'يجب أن يطابق تسجيلك في المصلحة. يُرسل كفرع ٠.')}</p></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={L('Governorate', 'المحافظة')}>{(id) => <Select id={id} value={addr.governate} onChange={(e) => setAddr({ ...addr, governate: e.target.value })}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</Select>}</Field>
                <Field label={L('City / district', 'المدينة / الحي')}>{(id) => <Input id={id} value={addr.regionCity} onChange={(e) => setAddr({ ...addr, regionCity: e.target.value })} />}</Field>
                <Field label={L('Street', 'الشارع')}>{(id) => <Input id={id} value={addr.street} onChange={(e) => setAddr({ ...addr, street: e.target.value })} />}</Field>
                <Field label={L('Building number', 'رقم المبنى')}>{(id) => <Input id={id} value={addr.buildingNumber} onChange={(e) => setAddr({ ...addr, buildingNumber: e.target.value })} />}</Field>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <div><h1 className="text-[22px] font-semibold">{L('Connect to ETA', 'الربط مع المصلحة')}</h1><p className="text-ink-muted mt-1">{L('On the ETA portal, open Taxpayer profile → ERP systems, register “Fatura”, and paste the credentials below.', 'من بوابة المصلحة: ملف الممول ← أنظمة ERP، سجّل "فاتورة" والصق البيانات هنا.')}</p></div>
              <Segmented value={env} onChange={setEnv} options={[{ value: 'preprod', label: L('Pre-production (recommended first)', 'بيئة الاختبار (موصى بها أولاً)') }, { value: 'production', label: L('Production', 'الإنتاج') }]} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={L('Client ID', 'معرّف العميل')}>{(id) => <Input id={id} dir="ltr" className="font-mono text-[13px]" value={cid} onChange={(e) => { setConn('idle'); setCid(e.target.value.trim()); }} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />}</Field>
                <Field label={L('Client secret', 'السر')}>{(id) => <Input id={id} type="password" dir="ltr" value={secret} onChange={(e) => { setConn('idle'); setSecret(e.target.value); }} />}</Field>
              </div>
              <Button variant="secondary" disabled={!cid || !secret} loading={conn === 'busy'} icon={<KeyRound className="size-4" />} onClick={async () => { setConn('busy'); await mockEta.login(); await mockEta.getDocumentTypes(); setConn('ok'); }}>{L('Test connection', 'اختبار الاتصال')}</Button>
              {conn === 'ok' && <Callout tone="ok" title={L('Connected. Token issued and document types loaded.', 'تم الاتصال وتحميل أنواع المستندات.')} />}
            </div>
          )}
          {step === 3 && (
            <div className="space-y-5">
              <div><h1 className="text-[22px] font-semibold">{L('Set up signing', 'إعداد التوقيع')}</h1><p className="text-ink-muted mt-1">{L('Install Fatura Signer on the PC with your USB token (Egypt Trust, MCDR or Fixed Misr). It signs locally — your private key never leaves the token.', 'ثبّت برنامج التوقيع على الجهاز المتصل بالتوكن. التوقيع محلي والمفتاح لا يغادر التوكن.')}</p></div>
              <ol className="space-y-3 text-[13.5px]">
                <li className="flex gap-3"><span className="size-6 rounded-full bg-sunken grid place-items-center text-[12px] font-semibold shrink-0">1</span>{L('Download and install Fatura Signer for Windows or macOS.', 'نزّل وثبّت برنامج التوقيع.')}</li>
                <li className="flex gap-3"><span className="size-6 rounded-full bg-sunken grid place-items-center text-[12px] font-semibold shrink-0">2</span>{L('Plug in the token and sign in to the agent with this account.', 'وصّل التوكن وسجّل الدخول في البرنامج.')}</li>
                <li className="flex gap-3"><span className="size-6 rounded-full bg-sunken grid place-items-center text-[12px] font-semibold shrink-0">3</span>{L('Click “Detect” — we sign a test document and verify the certificate belongs to your RIN.', 'اضغط "اكتشاف" — نوقّع مستنداً تجريبياً ونتحقق من الشهادة.')}</li>
              </ol>
              <Button variant="secondary" loading={signer === 'busy'} icon={signer === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <Usb className="size-4" />} onClick={async () => { setSigner('busy'); await new Promise((r) => setTimeout(r, 1200)); setSigner('ok'); }}>{L('Detect signer', 'اكتشاف برنامج التوقيع')}</Button>
              {signer === 'ok' && <Callout tone="ok" title={L(`Token found on ${db.signing.agent.host}`, `تم العثور على التوكن على ${db.signing.agent.host}`)}>{db.signing.certificate.issuer} · {db.signing.certificate.subject}</Callout>}
            </div>
          )}
          {step === 4 && (
            <div className="text-center py-6">
              <div className="size-14 mx-auto rounded-full bg-ok-soft text-ok grid place-items-center"><PartyPopper className="size-6" /></div>
              <h1 className="text-[24px] font-semibold mt-4">{L('You are ready to invoice', 'أنت جاهز لإصدار الفواتير')}</h1>
              <p className="text-ink-muted mt-2 max-w-[44ch] mx-auto">{env === 'preprod' ? L('Issue a few test invoices on pre-production, then switch to production in Settings → ETA connection.', 'أصدر فواتير تجريبية ثم انتقل للإنتاج من الإعدادات.') : L('Next: add your items and request their EGS codes, then issue your first invoice.', 'التالي: أضف أصنافك واطلب أكواد EGS ثم أصدر أول فاتورة.')}</p>
              <Button variant="primary" size="lg" className="mt-6" icon={<CheckCircle2 className="size-4" />} onClick={finish}>{L('Go to dashboard', 'الذهاب للوحة التحكم')}</Button>
            </div>
          )}
          {step < 4 && (
            <div className="flex justify-between mt-8 pt-5 border-t border-line">
              <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>{L('Back', 'رجوع')}</Button>
              <Button variant="primary" disabled={!steps[step].ok} onClick={() => setStep(step + 1)}>{L('Continue', 'متابعة')}</Button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
