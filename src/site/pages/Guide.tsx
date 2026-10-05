import { AlertTriangle, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { TAX_TYPES } from '@/eta/codes';
import { DOCUMENT_TYPES } from '@/eta/mockClient';
import { bi, useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Progress, cx } from '@/components/ui';
import { CtaBand, PageHero, Wrap } from '../kit';

const CHECK_KEY = 'fatura.readiness';

export function Guide() {
  const { db } = useStore();
  const { L, lang, money } = useI18n();
  const [done, setDone] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(CHECK_KEY) ?? '[]'); } catch { return []; } });
  useEffect(() => { try { localStorage.setItem(CHECK_KEY, JSON.stringify(done)); } catch { /* storage unavailable */ } }, [done]);
  const sections = [
    ['what', L('What e-invoicing means in Egypt', 'ما الفاتورة الإلكترونية في مصر')],
    ['documents', L('Document types', 'أنواع المستندات')],
    ['lifecycle', L('Lifecycle and statuses', 'دورة الحياة والحالات')],
    ['signing', L('Signing', 'التوقيع')],
    ['codes', L('Item codes', 'أكواد الأصناف')],
    ['taxes', L('Tax types', 'أنواع الضرائب')],
    ['receivers', L('Receivers and IDs', 'المستلمون والهويات')],
    ['windows', L('Cancel and reject windows', 'مهل الإلغاء والرفض')],
    ['checklist', L('Readiness checklist', 'قائمة الجاهزية')],
  ];
  const checklist = [
    ['portal', L('We can sign in to the ETA e-invoicing portal as taxpayer administrator', 'لدينا دخول مسؤول الممول على بوابة الفاتورة')],
    ['erp', L('Fatura is registered as an ERP system and we have pre-production credentials', 'سجلنا فاتورة كنظام ERP ولدينا بيانات الاختبار')],
    ['token', L('We have a signing certificate on a USB token (or a cloud/HSM option)', 'لدينا شهادة توقيع على توكن أو بديل سحابي')],
    ['branches', L('Our branches and their ETA branch codes are known', 'نعرف فروعنا وأكوادها لدى المصلحة')],
    ['codes', L('Every item we sell has a GS1 barcode or an approved EGS code', 'كل صنف له باركود GS1 أو كود EGS معتمد')],
    ['customers', L('Business customers have tax numbers on file', 'لدينا الأرقام الضريبية لعملائنا من الشركات')],
    ['test', L('We issued test invoices on pre-production and they validated', 'أصدرنا فواتير تجريبية واعتُمدت')],
  ];
  const toggle = (k: string) => setDone((d) => (d.includes(k) ? d.filter((x) => x !== k) : [...d, k]));
  const P = ({ children }: { children: React.ReactNode }) => <p className="text-[16px] leading-[1.75] text-ink-muted max-w-[68ch] mt-4">{children}</p>;
  const H = ({ id, children }: { id: string; children: React.ReactNode }) => <h2 id={id} className="scroll-mt-24 font-display text-[26px] font-semibold mt-16 first:mt-0">{children}</h2>;

  return (
    <>
      <PageHero kicker={L('Guide', 'دليل')} title={L('The ETA e-invoicing guide for finance teams.', 'دليل الفاتورة الإلكترونية للفرق المالية.')}
        lead={L('What the system expects, in plain language, with the parts that most often cause Invalid documents.', 'ما يتطلبه النظام بلغة واضحة، مع أكثر أسباب رفض المستندات.')} />
      <Wrap className="py-14 grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="hidden lg:block sticky top-24 self-start" aria-label={L('On this page', 'في هذه الصفحة')}>
          <div className="text-eyebrow uppercase text-ink-subtle mb-3">{L('On this page', 'في هذه الصفحة')}</div>
          <ul className="space-y-1 text-[13.5px]">{sections.map(([id, t]) => <li key={id}><button onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })} className="text-start text-ink-muted hover:text-ink py-1">{t}</button></li>)}</ul>
        </nav>
        <article className="min-w-0">
          <div className="flex gap-3 rounded-card border border-warn/30 bg-warn-soft p-4 text-[14px] text-ink mb-10">
            <AlertTriangle className="size-5 text-warn shrink-0" />
            <span>{L('This guide summarises how the system works. Rules and time limits are set by ETA and can change: always confirm against the official SDK and your tax advisor.', 'يلخص هذا الدليل عمل النظام. القواعد والمهل تحددها المصلحة وقد تتغير؛ راجع الحزمة الرسمية ومستشارك الضريبي.')} <a className="link inline-flex items-center gap-1" href="https://sdk.invoicing.eta.gov.eg" target="_blank" rel="noreferrer">sdk.invoicing.eta.gov.eg<ExternalLink className="size-3.5" /></a></span>
          </div>
          <H id="what">{sections[0][1]}</H>
          <P>{L('Companies registered for VAT that ETA has brought into the system must register every B2B sales document with ETA in a structured format, signed with a certificate issued to the company. ETA validates each document and returns a unique ID; only Valid documents count for tax.', 'الشركات المسجلة التي أدخلتها المصلحة في المنظومة يجب أن تسجل كل مستند بيع بصيغة منظمة موقعة بشهادة الشركة. تتحقق المصلحة وتعيد رقماً فريداً؛ والمستندات الصالحة وحدها تُحتسب.')}</P>
          <P>{L('Sales to consumers at the till are covered by a separate system, e-receipts, sent in real time from registered POS devices.', 'مبيعات المستهلكين في نقاط البيع تغطيها منظومة الإيصال الإلكتروني من الأجهزة المسجلة.')}</P>

          <H id="documents">{sections[1][1]}</H>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">{DOCUMENT_TYPES.map((t) => <div key={t.code} className="card p-4"><div className="flex items-center gap-2"><span className="font-mono text-[12px] px-1.5 rounded bg-sunken border border-line">{t.code}</span><span className="font-semibold">{t.name}</span></div><p className="mt-1.5 text-[13.5px] text-ink-muted">{t.description}</p></div>)}</div>

          <H id="lifecycle">{sections[2][1]}</H>
          <P>{L('A submitted document is Submitted until ETA finishes validation, then Valid or Invalid. A Valid document can later be Cancelled by the issuer or Rejected by the receiver, within the windows below. An Invalid document has no tax effect: fix it and submit a new one.', 'المستند المُرسل يبقى "مُرسلاً" حتى انتهاء التحقق ثم صالحاً أو غير صالح. يمكن للمُصدر إلغاء الصالح أو للمستلم رفضه خلال المهل. غير الصالح لا أثر ضريبي له.')}</P>

          <H id="signing">{sections[3][1]}</H>
          <P>{L('Each document is serialized into a canonical string, hashed with SHA-256 and signed CAdES-BES with your company certificate — most commonly on a USB token from a licensed certificate authority. The private key never leaves the token; Fatura Signer passes it only the hash.', 'يُحوّل كل مستند لصيغة موحدة ثم بصمة SHA-256 ويوقّع CAdES-BES بشهادة الشركة، غالباً على توكن من جهة مرخصة. المفتاح لا يغادر التوكن.')}</P>

          <H id="codes">{sections[4][1]}</H>
          <P>{L('Every line needs an item code ETA accepts for you: a GS1 barcode, or your own EGS code (EG-<your tax number>-<code>) that you request and ETA approves. Using a code before approval is the most common reason for Invalid documents.', 'كل بند يحتاج كوداً مقبولاً: باركود GS1 أو كود EGS خاص بك تطلبه وتعتمده المصلحة. استخدام الكود قبل اعتماده أكثر أسباب الرفض.')}</P>

          <H id="taxes">{sections[5][1]}</H>
          <P>{L('There are 20 tax types. T1–T12 are part of the taxable base where relevant; T13–T20 are non-taxable fees. Withholding tax (T4) is deducted from the line total.', 'هناك ٢٠ نوع ضريبة. T1–T12 ضمن الوعاء حسب الحالة، وT13–T20 رسوم غير خاضعة، والخصم تحت حساب الضريبة (T4) يُخصم من الإجمالي.')}</P>
          <div className="mt-5 overflow-x-auto rounded-card border border-line bg-surface">
            <table className="w-full text-[13.5px] min-w-[520px]"><tbody className="divide-y divide-line">{TAX_TYPES.map((t) => <tr key={t.code}><td className="p-3 font-mono w-16">{t.code}</td><td className="p-3">{bi(lang, t)}</td><td className="p-3 text-ink-subtle font-mono text-[12px]">{t.subTypes.map((s) => s.code).join(' ')}</td></tr>)}</tbody></table>
          </div>

          <H id="receivers">{sections[6][1]}</H>
          <P>{L(`Business receivers (B) need their 9-digit tax registration number. Individuals (P) need a 14-digit national ID once the document total reaches the threshold — Fatura applies ${money(db.settings.personIdThreshold)}. Foreign receivers (F) need a name and a non-Egyptian country.`, `المستلم التجاري يحتاج رقمه الضريبي، والفرد يحتاج الرقم القومي عند بلوغ الحد (تطبق فاتورة ${money(db.settings.personIdThreshold)})، والأجنبي يحتاج اسماً ودولة غير مصر.`)}</P>

          <H id="windows">{sections[7][1]}</H>
          <P>{L(`ETA sets per-document-type windows for cancelling, rejecting and declining. Fatura reads them from the document-type settings and shows a countdown on each document; at the time of writing the demo uses ${DOCUMENT_TYPES[0].workflowParameters.cancellationWindowHours / 24} days. After the window, adjust with a credit or debit note.`, `تحدد المصلحة مهل الإلغاء والرفض لكل نوع مستند، وتعرض فاتورة عداداً لكل مستند (يستخدم العرض ${DOCUMENT_TYPES[0].workflowParameters.cancellationWindowHours / 24} أيام). بعد المهلة استخدم الإشعارات.`)}</P>

          <H id="checklist">{sections[8][1]}</H>
          <div className="mt-5 card p-6">
            <div className="flex items-center justify-between text-[13px] mb-2"><span className="text-ink-muted">{L(`${done.length} of ${checklist.length} ready`, `${done.length} من ${checklist.length} جاهز`)}</span>{done.length === checklist.length && <span className="text-ok font-medium">{L('Ready to go live', 'جاهز للتشغيل')}</span>}</div>
            <Progress value={done.length / checklist.length} tone={done.length === checklist.length ? 'ok' : 'accent'} />
            <ul className="mt-5 space-y-1">
              {checklist.map(([k, t]) => (
                <li key={k}><label className={cx('flex items-start gap-3 rounded-control p-2.5 cursor-pointer hover:bg-sunken', done.includes(k) && 'text-ink-muted')}>
                  <input type="checkbox" id={`ready-${k}`} className="mt-1 size-4 accent-[rgb(var(--accent))]" checked={done.includes(k)} onChange={() => toggle(k)} />
                  <span className={done.includes(k) ? 'line-through decoration-ink-subtle/50' : ''}>{t}</span>
                </label></li>
              ))}
            </ul>
          </div>
        </article>
      </Wrap>
      <CtaBand title={L('Tick everything off with us.', 'أكمل القائمة معنا.')} lead={L('Onboarding covers credentials, signing, codes and a test invoice.', 'الإعداد يغطي البيانات والتوقيع والأكواد وفاتورة تجريبية.')} primary={{ to: '/signup', label: L('Start setup', 'ابدأ الإعداد') }} secondary={{ to: '/contact?topic=demo', label: L('Get help', 'اطلب مساعدة') }} />
    </>
  );
}
