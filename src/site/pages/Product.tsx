import { ArrowRight, Boxes, FileInput, FileText, Send, Wallet } from 'lucide-react';
import { type ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { Badge, LinkButton, StatusBadge } from '@/components/ui';
import { ArrowLink, Checks, CtaBand, PageHero, Section, Wrap } from '../kit';

function Module({ id, icon, title, lead, points, demo, aside }: { id: string; icon: ReactNode; title: string; lead: string; points: string[]; demo: { to: string; label: string }; aside: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 py-14 border-b border-line last:border-0 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] items-start">
      <div>
        <span className="size-10 rounded-control bg-accent-soft text-accent grid place-items-center [&>svg]:size-5">{icon}</span>
        <h2 className="mt-5 font-display text-title">{title}</h2>
        <p className="mt-3 text-lead text-ink-muted max-w-[56ch]">{lead}</p>
        <Checks className="mt-6 text-[15px]" items={points} />
        <ArrowLink to={demo.to} className="mt-7">{demo.label}</ArrowLink>
      </div>
      <div>{aside}</div>
    </section>
  );
}

export function Product() {
  const { L } = useI18n();
  const jump = [['invoicing', L('Invoicing', 'الفواتير')], ['submit', L('Sign & submit', 'التوقيع والإرسال')], ['payments', L('Payments', 'المدفوعات')], ['received', L('Received', 'الواردة')], ['codes', L('Item codes', 'الأكواد')]];
  return (
    <>
      <PageHero title={L('One workspace for every ETA document.', 'مساحة واحدة لكل مستندات المصلحة.')} lead={L('Compose, sign, submit, get paid and reconcile — with the tax rules built in rather than bolted on.', 'أنشئ ووقّع وأرسل وحصّل وطابق — بقواعد الضريبة مدمجة من الأساس.')}
        actions={<><LinkButton to="/signup" variant="primary" size="lg">{L('Start free trial', 'ابدأ التجربة')}</LinkButton><LinkButton to="/app" size="lg">{L('Open the demo', 'افتح العرض')}</LinkButton></>} />
      <div className="sticky top-16 z-20 bg-canvas/90 backdrop-blur border-b border-line">
        <Wrap className="flex gap-1 overflow-x-auto [scrollbar-width:none] py-2">
          {jump.map(([id, t]) => <button key={id} onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })} className="h-8 px-3 rounded-full text-[13px] font-medium text-ink-muted hover:text-ink hover:bg-sunken whitespace-nowrap">{t}</button>)}
        </Wrap>
      </div>
      <Wrap>
        <Module id="invoicing" icon={<FileText />} title={L('Invoices, credit and debit notes, export invoices', 'فواتير وإشعارات دائنة ومدينة وفواتير تصدير')}
          lead={L('A one-page composer with live totals by tax type and a pre-flight checklist that mirrors ETA validation.', 'محرر من صفحة واحدة بإجماليات فورية وقائمة فحص تحاكي تحقق المصلحة.')}
          points={[L('Catalog items fill the ETA code, unit and taxes', 'الأصناف تملأ الكود والوحدة والضرائب'), L('Foreign currency with EGP conversion per line', 'عملات أجنبية مع التحويل للجنيه لكل بند'), L('Credit and debit notes linked to the original UUID', 'إشعارات مرتبطة برقم الفاتورة الأصلية'), L('Bilingual PDF with the ETA verification QR', 'PDF ثنائي اللغة مع رمز التحقق')]}
          demo={{ to: '/app/documents/new', label: L('Open the composer', 'افتح المحرر') }}
          aside={<div className="card p-5 space-y-3 text-[14px]">{[['INV-2026-00100', 'Valid'], ['CN-2026-00001', 'Valid'], ['INV-2026-00081', 'Draft'], ['INV-2026-00012', 'Invalid']].map(([n, s]) => <div key={n} className="flex items-center justify-between rounded-control border border-line px-4 py-3"><span className="font-medium">{n}</span><StatusBadge status={s as 'Valid'} /></div>)}</div>} />
        <Module id="submit" icon={<Send />} title={L('Sign once, submit in bulk', 'وقّع مرة وأرسل دفعة واحدة')}
          lead={L('Select drafts, sign them with your token through Fatura Signer, and submit as one batch. Results come back per document.', 'اختر المسودات ووقّعها بالتوكن وأرسلها دفعة واحدة، والنتائج لكل مستند.')}
          points={[L('USB token, on-premise HSM or cloud eSeal', 'توكن USB أو HSM أو ختم سحابي'), L('Automatic retries on ETA outages, nothing lost', 'إعادة محاولة تلقائية عند الأعطال'), L('Submission log with every ETA response', 'سجل إرسال بكل ردود المصلحة'), L('Cancellation window countdown on each document', 'عداد مهلة الإلغاء على كل مستند')]}
          demo={{ to: '/app/submissions', label: L('See the submissions log', 'اعرض سجل الإرسال') }}
          aside={<div className="card p-6"><div className="text-[13px] text-ink-muted">{L('Batch of 24 drafts', 'دفعة من ٢٤ مسودة')}</div><div className="mt-3 flex gap-1">{Array.from({ length: 24 }, (_, i) => <span key={i} className={i === 17 ? 'h-8 flex-1 rounded-sm bg-bad' : 'h-8 flex-1 rounded-sm bg-ok'} />)}</div><div className="mt-3 flex justify-between text-[13px]"><span className="text-ok font-medium">{L('23 Valid', '٢٣ صالحة')}</span><span className="text-bad font-medium">{L('1 Invalid — code not active', '١ غير صالحة — كود غير نشط')}</span></div></div>} />
        <Module id="payments" icon={<Wallet />} title={L('Know who owes what, and when', 'اعرف من يدين بماذا ومتى')}
          lead={L('Aged receivables, installment trackers and one-click payment recording, right next to the tax documents.', 'أعمار الديون ومتابعة الأقساط وتسجيل الدفعات بجوار المستندات.')}
          points={[L('One payment, recurring and installment plans', 'دفعة واحدة ومتكررة وأقساط'), L('InstaPay, transfer, cheque, cash and card', 'إنستاباي وتحويل وشيك ونقدي وبطاقة'), L('Overdue alerts and reminders', 'تنبيهات وتذكيرات التأخير')]}
          demo={{ to: '/app/receivables', label: L('Open payments & installments', 'افتح المدفوعات والأقساط') }}
          aside={<div className="card p-6 grid grid-cols-5 gap-2 text-center text-[12px]">{[[L('Not due', 'لم تستحق'), 62], [L('1–30', '١–٣٠'), 21], [L('31–60', '٣١–٦٠'), 9], [L('61–90', '٦١–٩٠'), 5], [L('90+', '+٩٠'), 3]].map(([k, v], i) => <div key={i}><div className="h-28 rounded-control bg-sunken flex items-end overflow-hidden"><div className={i === 0 ? 'w-full bg-ok' : i < 3 ? 'w-full bg-warn' : 'w-full bg-bad'} style={{ height: `${v}%` }} /></div><div className="mt-2 text-ink-muted">{k}</div><div className="font-medium tabular">{v}%</div></div>)}</div>} />
        <Module id="received" icon={<FileInput />} title={L('Supplier documents, under control', 'مستندات الموردين تحت السيطرة')}
          lead={L('Everything issued against your tax number lands in one inbox, synced from ETA.', 'كل ما يصدر على رقمك الضريبي في صندوق واحد متزامن مع المصلحة.')}
          points={[L('Reject a wrong document within the window', 'ارفض المستند الخاطئ خلال المهلة'), L('Accept or decline a supplier’s cancellation', 'اقبل أو ارفض طلب إلغاء المورد'), L('Input VAT totals for your return', 'إجمالي ضريبة المدخلات للإقرار')]}
          demo={{ to: '/app/received', label: L('Open the inbox', 'افتح الصندوق') }}
          aside={<div className="card p-5 text-[14px]"><div className="flex items-center justify-between"><span className="font-medium">Raya Distribution</span><Badge tone="warn">{L('Cancel requested', 'طلب إلغاء')}</Badge></div><p className="mt-2 text-ink-muted text-[13px]">{L('Decline if you already booked it and received the goods.', 'ارفض إن كنت سجلته واستلمت البضاعة.')}</p><div className="mt-4 flex gap-2"><span className="h-8 px-3 rounded-control border border-line grid place-items-center text-[13px]">{L('Decline', 'رفض')}</span><span className="h-8 px-3 rounded-control bg-accent text-accent-on grid place-items-center text-[13px]">{L('Accept', 'قبول')}</span></div></div>} />
        <Module id="codes" icon={<Boxes />} title={L('Item codes that pass the Code validator', 'أكواد تجتاز مدقق الأكواد')}
          lead={L('The most common cause of Invalid documents is an item code that isn’t active. Fatura tracks approval and blocks rejected codes.', 'أكثر أسباب الرفض شيوعاً كود غير نشط. فاتورة تتابع الاعتماد وتمنع الأكواد المرفوضة.')}
          points={[L('Bulk EGS code requests with GPC parent', 'طلب أكواد EGS جماعياً'), L('GS1 barcodes accepted as-is', 'قبول باركود GS1 مباشرة'), L('All 100 ETA unit types, common ones first', 'كل وحدات القياس المئة')]}
          demo={{ to: '/app/items', label: L('Open items & codes', 'افتح الأصناف والأكواد') }}
          aside={<div className="card p-5 font-mono text-[12.5px] space-y-2" dir="ltr">{[['EG-100483726-IMPL01', 'ok'], ['EG-100483726-POS01', 'info'], ['EG-100483726-MIG01', 'bad'], ['6221234500017', 'ok']].map(([c, t]) => <div key={c} className="flex items-center justify-between gap-2 rounded-control border border-line px-3 py-2"><span className="truncate">{c}</span><Badge tone={t as 'ok'}>{t === 'ok' ? 'Approved' : t === 'info' ? 'Pending' : 'Rejected'}</Badge></div>)}</div>} />
      </Wrap>
      <Section tone="surface">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div><h2 className="font-display text-title">{L('Also in every plan', 'متاح أيضاً في كل الباقات')}</h2><p className="mt-2 text-ink-muted">{L('Arabic and English everywhere, team roles, audit trail, and a monthly VAT report.', 'العربية والإنجليزية، أدوار الفريق، سجل التدقيق، وتقرير الضريبة الشهري.')}</p></div>
          <LinkButton to="/pricing" icon={<ArrowRight className="size-4 rtl:rotate-180" />}>{L('Compare plans', 'قارن الباقات')}</LinkButton>
        </div>
      </Section>
      <CtaBand title={L('See it with your own data.', 'شاهدها ببياناتك.')} lead={L('Book a 30-minute walkthrough with your invoices and ERP export.', 'احجز جولة ٣٠ دقيقة بفواتيرك وملف ERP.')} primary={{ to: '/contact?topic=demo', label: L('Book a demo', 'احجز عرضاً') }} secondary={{ to: '/signup', label: L('Start free', 'ابدأ مجاناً') }} />
    </>
  );
}
