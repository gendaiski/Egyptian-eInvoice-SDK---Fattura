import {
  ArrowLeft, Ban, Check, CheckCircle2, Copy as CopyIcon, ExternalLink, FileMinus, FilePlus, Loader2, Mail, PenLine, Printer, Send, Trash2, Undo2, Wallet, XCircle,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { publicDocumentUrl } from '@/eta/client';
import { DOCUMENT_TYPES } from '@/eta/mockClient';
import { useI18n } from '@/i18n';
import { docTotal, dueInfo, paidAmount, uid, windowHoursLeft, type Doc, type PaymentRecord } from '@/store/model';
import { useActions, useStore } from '@/store/store';
import { InvoicePaper } from '@/components/InvoicePaper';
import { printPage } from '@/lib/files';
import {
  Button, Callout, Card, CopyButton, DescList, Field, Input, LinkButton, Modal, Money, Mono, Progress, Select, StatusBadge, Textarea, cx, useToast,
} from '@/components/ui';
import { NotFound } from '../NotFound';
import { PlanBadge, useLabels } from './shared';

export function DocumentDetail() {
  const { id } = useParams();
  const { db } = useStore();
  const doc = db.docs.find((d) => d.id === id);
  if (!doc) return <NotFound />;
  return <Detail doc={doc} />;
}

function Detail({ doc }: { doc: Doc }) {
  const { db } = useStore();
  const actions = useActions();
  const { L, date, rel, money } = useI18n();
  const lb = useLabels();
  const nav = useNavigate();
  const toast = useToast();
  const [dialog, setDialog] = useState<'' | 'cancel' | 'reject' | 'pay' | 'email' | 'delete'>('');
  const [busy, setBusy] = useState(false);

  const sent = doc.direction === 'sent';
  const wf = DOCUMENT_TYPES.find((t) => t.code === doc.documentType)?.workflowParameters ?? DOCUMENT_TYPES[0].workflowParameters;
  const hoursLeft = windowHoursLeft(doc, sent ? wf.cancellationWindowHours : wf.rejectionWindowHours);
  const total = docTotal(doc);
  const due = dueInfo(doc);
  const url = doc.uuid && doc.longId ? publicDocumentUrl(doc.uuid, doc.longId, db.integration.env) : '';
  const isInvoice = doc.documentType === 'I' || doc.documentType === 'EI';
  const notes = db.docs.filter((d) => d.references?.includes(doc.uuid ?? '__'));
  const recurring = doc.recurringId ? db.recurring.find((r) => r.id === doc.recurringId) : undefined;

  const doSubmit = async () => {
    if (db.signing.agent.status !== 'online') { toast({ tone: 'bad', text: L('Signing agent is offline.', 'وكيل التوقيع غير متصل.') }); return; }
    setBusy(true); await actions.submit([doc.id]); setBusy(false);
  };

  const headerActions: ReactNode[] = [];
  if (doc.status === 'Draft') {
    headerActions.push(
      <Button key="del" variant="ghost" icon={<Trash2 className="size-4" />} onClick={() => setDialog('delete')}>{L('Delete', 'حذف')}</Button>,
      <LinkButton key="edit" to={`/app/documents/${doc.id}/edit`} icon={<PenLine className="size-4" />}>{L('Edit', 'تعديل')}</LinkButton>,
      <Button key="sub" variant="primary" icon={<Send className="size-4" />} loading={busy} onClick={doSubmit}>{L('Sign & submit', 'توقيع وإرسال')}</Button>,
    );
  }
  if (doc.status === 'Valid' && sent) {
    headerActions.push(<Button key="print" icon={<Printer className="size-4" />} onClick={() => { if (!printPage()) toast({ tone: 'info', text: L('Printing is disabled in this live preview; the deployed app opens Save as PDF.', 'الطباعة غير متاحة في هذه المعاينة؛ التطبيق المنشور يفتح الحفظ كـ PDF.') }); }}>{L('PDF', 'PDF')}</Button>);
    headerActions.push(<Button key="mail" icon={<Mail className="size-4" />} onClick={() => setDialog('email')}>{L('Send', 'إرسال')}</Button>);
    if (isInvoice && due.outstanding > 0) headerActions.push(<Button key="pay" variant="primary" icon={<Wallet className="size-4" />} onClick={() => setDialog('pay')}>{L('Record payment', 'تسجيل دفعة')}</Button>);
  }
  if (doc.status === 'Invalid' && sent) {
    headerActions.push(<Button key="fix" variant="primary" icon={<CopyIcon className="size-4" />} onClick={() => {
      const copy: Doc = { ...structuredClone(doc), id: uid('d'), status: 'Draft', internalID: actions.nextNumber(doc.documentType), uuid: undefined, longId: undefined, submissionId: undefined, submittedAt: undefined, validatedAt: undefined, steps: undefined, payments: [], issuedAt: new Date().toISOString(), events: [{ at: new Date().toISOString(), type: 'created', by: db.session.user.name, note: `Corrected copy of ${doc.internalID}` }] };
      actions.saveDoc(copy);
      nav(`/app/documents/${copy.id}/edit`);
    }}>{L('Correct & resubmit', 'تصحيح وإعادة الإرسال')}</Button>);
  }

  return (
    <div className="animate-in">
      <div className="mb-6">
        <Link to={sent ? '/app/documents' : '/app/received'} className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink mb-2"><ArrowLeft className="size-4 rtl:rotate-180" />{sent ? L('Invoices & notes', 'الفواتير والإشعارات') : L('Received documents', 'المستندات الواردة')}</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[24px] sm:text-[28px] font-semibold leading-tight">{doc.internalID}</h1>
              <StatusBadge status={doc.status} />
              {sent && <PlanBadge plan={recurring ? { kind: 'recurring' } as never : doc.plan} />}
            </div>
            <p className="mt-1 text-ink-muted">{lb.docType(doc.documentType)} · {sent ? L('to', 'إلى') : L('from', 'من')} <span className="text-ink">{doc.counterparty.name ?? L('Walk-in customer', 'عميل نقدي')}</span> · {date(doc.issuedAt, 'long')}</p>
          </div>
          <div className="flex flex-wrap gap-2">{headerActions}</div>
        </div>
      </div>

      <Lifecycle doc={doc} />

      {doc.status === 'Invalid' && (
        <div className="mb-5"><Callout tone="bad" title={L('ETA marked this document Invalid', 'المصلحة اعتبرت المستند غير صالح')}>
          {L('It does not count for tax. Correct the issue below and submit a new document — the invalid one stays on record.', 'لا يُحتسب ضريبياً. صحّح المشكلة وأرسل مستنداً جديداً — يبقى المستند غير الصالح في السجل.')}
        </Callout></div>
      )}
      {doc.pending === 'cancellation_requested' && (
        <div className="mb-5"><Callout tone="warn" title={L('The issuer asked to cancel this document', 'طلب المُصدر إلغاء هذا المستند')}
          action={<div className="flex gap-2"><Button size="sm" onClick={async () => { await actions.declineCancellation(doc.id); toast({ tone: 'ok', text: L('Cancellation declined.', 'تم رفض الإلغاء.') }); }}>{L('Decline', 'رفض')}</Button><Button size="sm" variant="primary" onClick={() => actions.acceptCancellation(doc.id)}>{L('Accept', 'قبول')}</Button></div>}>
          {L('If you do nothing, ETA completes the cancellation when the window closes.', 'إن لم تتخذ إجراءً، تُكمل المصلحة الإلغاء عند انتهاء المهلة.')}
        </Callout></div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="min-w-0 space-y-5">
          <InvoicePaper doc={doc} company={db.company} env={db.integration.env} />
          {doc.steps && <ValidationSteps doc={doc} />}
        </div>

        <aside className="space-y-4">
          {doc.uuid && (
            <Card title={L('ETA record', 'سجل المصلحة')}>
              <DescList cols={1} items={[
                { k: 'UUID', v: <span className="flex items-center gap-2"><Mono className="break-all">{doc.uuid}</Mono><CopyButton value={doc.uuid} /></span> },
                { k: L('Submission ID', 'رقم الإرسال'), v: doc.submissionId ? <Link to="/app/submissions" className="link"><Mono>{doc.submissionId}</Mono></Link> : '—' },
                { k: L('Submitted', 'وقت الإرسال'), v: date(doc.submittedAt, 'datetime') },
                { k: L('Validated', 'وقت التحقق'), v: doc.validatedAt ? date(doc.validatedAt, 'datetime') : <span className="inline-flex items-center gap-1.5 text-info"><Loader2 className="size-3.5 animate-spin" />{L('Validating…', 'جارٍ التحقق…')}</span> },
              ]} />
              {url && doc.status === 'Valid' && <a href={url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium link">{L('Open on ETA portal', 'فتح على بوابة المصلحة')}<ExternalLink className="size-3.5" /></a>}
            </Card>
          )}

          {doc.status === 'Valid' && (
            <Card title={sent ? L('Cancellation window', 'مهلة الإلغاء') : L('Rejection window', 'مهلة الرفض')}>
              {hoursLeft > 0 ? (
                <>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[22px] font-semibold tabular">{hoursLeft >= 24 ? L(`${Math.floor(hoursLeft / 24)}d ${Math.floor(hoursLeft % 24)}h`, `${Math.floor(hoursLeft / 24)} يوم ${Math.floor(hoursLeft % 24)} ساعة`) : L(`${Math.floor(hoursLeft)}h`, `${Math.floor(hoursLeft)} ساعة`)}</span>
                    <span className="text-[12.5px] text-ink-subtle">{L('left', 'متبقية')}</span>
                  </div>
                  <Progress className="mt-2" value={hoursLeft / (sent ? wf.cancellationWindowHours : wf.rejectionWindowHours)} tone={hoursLeft < 24 ? 'warn' : 'accent'} />
                  <p className="mt-3 text-[12.5px] text-ink-muted">{sent
                    ? L('Cancel only to fix a mistake spotted right away. After the window, issue a credit note instead.', 'استخدم الإلغاء لتصحيح خطأ فوري فقط. بعد المهلة أصدر إشعاراً دائناً.')
                    : L('Reject if the document is wrong; the issuer can decline your rejection once.', 'ارفض إن كان المستند خاطئاً؛ يمكن للمُصدر رفض طلبك مرة واحدة.')}</p>
                  <Button className="mt-3 w-full" variant="secondary" icon={sent ? <Ban className="size-4" /> : <Undo2 className="size-4" />} onClick={() => setDialog(sent ? 'cancel' : 'reject')}>
                    {sent ? L('Cancel document', 'إلغاء المستند') : L('Reject document', 'رفض المستند')}
                  </Button>
                </>
              ) : (
                <p className="text-ink-muted text-[13px]">{L('The window has closed. Adjust with a credit or debit note.', 'انتهت المهلة. استخدم إشعاراً دائناً أو مديناً للتعديل.')}</p>
              )}
              {sent && isInvoice && (
                <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-line">
                  <LinkButton size="sm" to={`/app/documents/new?type=C&ref=${doc.id}`} icon={<FileMinus className="size-4" />}>{L('Credit note', 'إشعار دائن')}</LinkButton>
                  <LinkButton size="sm" to={`/app/documents/new?type=D&ref=${doc.id}`} icon={<FilePlus className="size-4" />}>{L('Debit note', 'إشعار مدين')}</LinkButton>
                </div>
              )}
            </Card>
          )}

          {(doc.status === 'Cancelled' || doc.status === 'Rejected') && (
            <Card title={doc.status === 'Cancelled' ? L('Cancelled', 'ملغى') : L('Rejected by receiver', 'رفضه المستلم')}>
              <p className="text-ink">{doc.stateReason ?? '—'}</p>
              <p className="mt-1 text-[12.5px] text-ink-subtle">{date(doc.stateChangedAt, 'datetime')}</p>
            </Card>
          )}

          {sent && isInvoice && doc.status === 'Valid' && (
            <Card title={L('Payments', 'المدفوعات')}>
              <div className="flex items-baseline justify-between">
                <span className="text-ink-muted">{L('Paid', 'المدفوع')} <Money value={paidAmount(doc)} className="text-ink font-medium" /></span>
                <span className="text-ink-muted">{L('of', 'من')} <Money value={total} /></span>
              </div>
              <Progress className="mt-2" value={paidAmount(doc) / (total || 1)} tone={due.state === 'overdue' ? 'bad' : 'ok'} />
              {doc.installments?.length ? (
                <ol className="mt-4 space-y-2">
                  {doc.installments.map((r) => {
                    const done = r.paid >= r.amount - 0.005;
                    const late = !done && r.dueDate < new Date().toISOString().slice(0, 10);
                    return (
                      <li key={r.n} className="flex items-center gap-3 text-[13px]">
                        <span className={cx('size-5 rounded-full grid place-items-center shrink-0 border', done ? 'bg-ok border-ok text-white' : late ? 'border-bad text-bad' : 'border-line text-ink-subtle')}>{done ? <Check className="size-3" /> : <span className="text-[10px] font-semibold">{r.n || '•'}</span>}</span>
                        <span className="flex-1 min-w-0"><span className="text-ink">{r.label === 'down' ? L('Down payment', 'دفعة مقدمة') : L(`Installment ${r.n}`, `القسط ${r.n}`)}</span><span className={cx('block text-[12px]', late ? 'text-bad' : 'text-ink-subtle')}>{date(r.dueDate)}{late ? ` · ${L('overdue', 'متأخر')}` : ''}</span></span>
                        <Money value={r.amount} className={done ? 'text-ink-subtle line-through' : 'text-ink'} />
                      </li>
                    );
                  })}
                </ol>
              ) : due.dueDate ? <p className="mt-3 text-[13px] text-ink-muted">{L('Due', 'تستحق')} {date(due.dueDate, 'long')} · {lb.terms(doc.plan.kind === 'one-time' ? doc.plan.terms : 'net30')}</p> : null}
              {doc.payments.length > 0 && (
                <ul className="mt-4 pt-3 border-t border-line space-y-1.5 text-[13px]">
                  {doc.payments.map((p) => <li key={p.id} className="flex justify-between gap-2"><span className="text-ink-muted">{date(p.date)} · {lb.method(p.method)}</span><Money value={p.amount} /></li>)}
                </ul>
              )}
            </Card>
          )}

          {(recurring || notes.length > 0) && (
            <Card title={L('Related', 'مرتبط')}>
              <ul className="space-y-2 text-[13px]">
                {recurring && <li><Link className="link" to={`/app/recurring/${recurring.id}`}>{recurring.name}</Link> <span className="text-ink-subtle">· {L('recurring schedule', 'جدول متكرر')}</span></li>}
                {notes.map((n) => <li key={n.id} className="flex items-center justify-between gap-2"><Link className="link" to={`/app/documents/${n.id}`}>{n.internalID}</Link><span className="text-ink-subtle">{lb.docType(n.documentType)} · {money(docTotal(n))}</span></li>)}
              </ul>
            </Card>
          )}

          <Card title={L('Activity', 'السجل')}>
            <ol className="relative border-s border-line ms-1.5 space-y-4">
              {[...doc.events].reverse().map((e, i) => (
                <li key={i} className="ps-4 relative">
                  <span className={cx('absolute -start-[5px] top-1.5 size-2.5 rounded-full ring-4 ring-surface', e.type === 'valid' ? 'bg-ok' : e.type === 'invalid' ? 'bg-bad' : e.type === 'payment' ? 'bg-accent' : 'bg-ink-subtle')} />
                  <div className="text-[13px] text-ink">{eventLabel(e.type, L)}</div>
                  {e.note && <div className="text-[12.5px] text-ink-muted">{e.note}</div>}
                  <div className="text-[12px] text-ink-subtle">{e.by} · {rel(e.at)}</div>
                </li>
              ))}
            </ol>
          </Card>
        </aside>
      </div>

      <StateDialog open={dialog === 'cancel' || dialog === 'reject'} mode={dialog === 'reject' ? 'reject' : 'cancel'} onClose={() => setDialog('')}
        onConfirm={async (reason) => { if (dialog === 'reject') await actions.reject(doc.id, reason); else await actions.cancel(doc.id, reason); setDialog(''); toast({ tone: 'ok', text: dialog === 'reject' ? L('Rejection sent to ETA.', 'تم إرسال الرفض للمصلحة.') : L('Cancellation sent to ETA.', 'تم إرسال الإلغاء للمصلحة.') }); }} />
      <PaymentDialog open={dialog === 'pay'} doc={doc} onClose={() => setDialog('')} onSave={(p) => { actions.recordPayment(doc.id, p); setDialog(''); toast({ tone: 'ok', text: L('Payment recorded.', 'تم تسجيل الدفعة.') }); }} />
      <Modal open={dialog === 'email'} onClose={() => setDialog('')} title={L('Send to customer', 'إرسال للعميل')}
        footer={<><Button onClick={() => setDialog('')}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" icon={<Send className="size-4" />} onClick={() => { setDialog(''); toast({ tone: 'ok', text: L('Invoice emailed with PDF and ETA verification link.', 'تم إرسال الفاتورة مع رابط التحقق.') }); }}>{L('Send email', 'إرسال')}</Button></>}>
        <div className="space-y-4">
          <Field label={L('To', 'إلى')}>{(fid) => <Input id={fid} dir="ltr" defaultValue={db.customers.find((c) => c.id === doc.customerId)?.email ?? ''} />}</Field>
          <Field label={L('Message', 'الرسالة')}>{(fid) => <Textarea id={fid} defaultValue={L(`Dear ${doc.counterparty.name},\n\nPlease find attached ${doc.internalID} for ${money(total)}. It is registered with the Egyptian Tax Authority (UUID ${doc.uuid}).\n\nThank you.`, `السادة ${doc.counterparty.name}،\n\nمرفق ${doc.internalID} بقيمة ${money(total)}، مسجلة لدى مصلحة الضرائب المصرية.\n\nشكراً لكم.`)} className="min-h-[150px]" />}</Field>
        </div>
      </Modal>
      <Modal open={dialog === 'delete'} onClose={() => setDialog('')} size="sm" title={L('Delete draft?', 'حذف المسودة؟')}
        footer={<><Button onClick={() => setDialog('')}>{L('Keep', 'إبقاء')}</Button><Button variant="danger" onClick={() => { actions.deleteDraft(doc.id); nav('/app/documents'); toast({ tone: 'ok', text: L('Draft deleted.', 'تم حذف المسودة.') }); }}>{L('Delete', 'حذف')}</Button></>}>
        <p className="text-ink-muted">{L('This draft was never sent to ETA, so deleting it has no tax effect.', 'لم تُرسل هذه المسودة للمصلحة، لذا حذفها لا أثر ضريبي له.')}</p>
      </Modal>
    </div>
  );
}

function eventLabel(t: string, L: (en: string, ar: string) => string) {
  const m: Record<string, [string, string]> = {
    created: ['Created', 'تم الإنشاء'], generated: ['Generated by schedule', 'أُنشئت من الجدول'], signed: ['Signed with USB token', 'وُقّعت بالتوكن'], submitted: ['Submitted to ETA', 'أُرسلت للمصلحة'],
    valid: ['Validated — Valid', 'تم التحقق — صالحة'], invalid: ['Validated — Invalid', 'تم التحقق — غير صالحة'], cancelled: ['Cancelled', 'أُلغيت'], rejected: ['Rejected', 'رُفضت'],
    payment: ['Payment recorded', 'سُجلت دفعة'], received: ['Received from ETA', 'استُلمت من المصلحة'], cancellation_declined: ['Cancellation declined', 'رُفض الإلغاء'],
  };
  return m[t] ? L(m[t][0], m[t][1]) : t;
}

function Lifecycle({ doc }: { doc: Doc }) {
  const { L } = useI18n();
  if (doc.direction !== 'sent') return null;
  const order = ['Draft', 'Signing', 'Submitted', 'Valid'];
  const terminal = doc.status === 'Invalid' ? 'bad' : doc.status === 'Cancelled' || doc.status === 'Rejected' ? 'warn' : null;
  const idx = terminal ? 3 : order.indexOf(doc.status);
  const steps = [L('Draft', 'مسودة'), L('Signed', 'موقّعة'), L('Submitted', 'مُرسلة'), terminal === 'bad' ? L('Invalid', 'غير صالحة') : doc.status === 'Cancelled' ? L('Cancelled', 'ملغاة') : doc.status === 'Rejected' ? L('Rejected', 'مرفوضة') : L('Valid', 'صالحة')];
  return (
    <ol className="card flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-3.5 mb-5 overflow-x-auto" aria-label={L('Document lifecycle', 'دورة حياة المستند')}>
      {steps.map((s, i) => {
        const done = i < idx || (i === idx && i === 3);
        const active = i === idx && i < 3;
        const last = i === 3;
        return (
          <li key={i} className="flex items-center gap-2 sm:gap-3 shrink-0">
            <span className={cx('size-6 rounded-full grid place-items-center text-[11px] font-semibold border',
              last && done && terminal === 'bad' ? 'bg-bad border-bad text-white' : last && done && terminal === 'warn' ? 'bg-warn border-warn text-white' : done ? 'bg-ok border-ok text-white' : active ? 'border-accent text-accent' : 'border-line text-ink-subtle')}>
              {last && done && terminal === 'bad' ? <XCircle className="size-3.5" /> : done ? <CheckCircle2 className="size-3.5" /> : active && i > 0 ? <Loader2 className="size-3.5 animate-spin" /> : i + 1}
            </span>
            <span className={cx('text-[13px] font-medium', done || active ? 'text-ink' : 'text-ink-subtle')}>{s}</span>
            {i < 3 && <span className={cx('w-6 sm:w-12 h-px', i < idx ? 'bg-ok' : 'bg-line')} />}
          </li>
        );
      })}
    </ol>
  );
}

function ValidationSteps({ doc }: { doc: Doc }) {
  const { L } = useI18n();
  return (
    <Card title={L('ETA validation results', 'نتائج تحقق المصلحة')} subtitle={L('From Get Document Details · validationResults', 'من واجهة تفاصيل المستند')}>
      <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {doc.steps!.map((s) => (
          <li key={s.name} className={cx('text-[13px]', s.status === 'Invalid' && 'sm:col-span-2')}>
            <div className="flex items-center gap-2">
              {s.status === 'Valid' ? <CheckCircle2 className="size-4 text-ok" /> : <XCircle className="size-4 text-bad" />}
              <span className={s.status === 'Valid' ? 'text-ink-muted' : 'text-ink font-medium'}>{s.name}</span>
            </div>
            {s.error && (
              <div className="mt-2 ms-6 rounded-md bg-bad-soft border border-bad/20 p-3">
                <div className="font-medium text-bad">{s.error.message}</div>
                <div className="mt-1 text-[12px] text-ink-muted"><Mono>{s.error.code}</Mono> · <Mono>{s.error.propertyPath}</Mono></div>
                {s.error.code === 'ItemCodeNotActive' && <Link to="/app/items" className="mt-2 inline-block text-[12.5px] link">{L('Check item codes', 'مراجعة أكواد الأصناف')}</Link>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function StateDialog({ open, mode, onClose, onConfirm }: { open: boolean; mode: 'cancel' | 'reject'; onClose(): void; onConfirm(reason: string): Promise<void> }) {
  const { L } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const presets = mode === 'cancel'
    ? [L('Wrong customer', 'عميل خاطئ'), L('Wrong amount or quantity', 'مبلغ أو كمية خاطئة'), L('Duplicate document', 'مستند مكرر')]
    : [L('Goods or services not received', 'لم تُستلم البضاعة أو الخدمة'), L('Amount does not match the PO', 'المبلغ لا يطابق أمر الشراء'), L('Wrong receiver details', 'بيانات المستلم خاطئة')];
  return (
    <Modal open={open} onClose={onClose} title={mode === 'cancel' ? L('Cancel this document?', 'إلغاء هذا المستند؟') : L('Reject this document?', 'رفض هذا المستند؟')}
      footer={<><Button onClick={onClose}>{L('Back', 'رجوع')}</Button><Button variant="danger" disabled={reason.trim().length < 3} loading={busy} onClick={async () => { setBusy(true); await onConfirm(reason); setBusy(false); setReason(''); }}>{mode === 'cancel' ? L('Cancel document', 'إلغاء المستند') : L('Reject document', 'رفض المستند')}</Button></>}>
      <div className="space-y-4">
        <Callout tone="warn">{mode === 'cancel' ? L('ETA notifies the receiver, who can decline the cancellation. This cannot be undone from your side.', 'تُخطر المصلحة المستلم، ويمكنه رفض الإلغاء. لا يمكنك التراجع.') : L('Rejection can be done only once per document.', 'يمكن الرفض مرة واحدة فقط لكل مستند.')}</Callout>
        <div className="flex flex-wrap gap-2">{presets.map((p) => <button key={p} type="button" onClick={() => setReason(p)} className={cx('h-7 px-2.5 rounded-full border text-[12.5px]', reason === p ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-muted hover:text-ink')}>{p}</button>)}</div>
        <Field label={L('Reason (sent to ETA)', 'السبب (يُرسل للمصلحة)')}>{(fid) => <Textarea id={fid} value={reason} onChange={(e) => setReason(e.target.value)} />}</Field>
      </div>
    </Modal>
  );
}

export function PaymentDialog({ open, doc, onClose, onSave }: { open: boolean; doc: Doc; onClose(): void; onSave(p: Omit<PaymentRecord, 'id'>): void }) {
  const { L } = useI18n();
  const lb = useLabels();
  const outstanding = dueInfo(doc).outstanding;
  const nextInst = doc.installments?.find((i) => i.paid < i.amount - 0.005);
  const suggested = nextInst ? Math.round((nextInst.amount - nextInst.paid) * 100) / 100 : outstanding;
  const [amount, setAmount] = useState<number | ''>('');
  const [d, setD] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentRecord['method']>('bank');
  const val = amount === '' ? suggested : amount;
  return (
    <Modal open={open} onClose={onClose} title={L(`Record payment · ${doc.internalID}`, `تسجيل دفعة · ${doc.internalID}`)}
      footer={<><Button onClick={onClose}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" disabled={!(val > 0) || val > outstanding + 0.005} onClick={() => { onSave({ amount: val, date: d, method }); setAmount(''); }}>{L('Record payment', 'تسجيل الدفعة')}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={L('Amount (EGP)', 'المبلغ')} hint={nextInst ? L(`Next installment: ${suggested.toFixed(2)}`, `القسط التالي: ${suggested.toFixed(2)}`) : L(`Outstanding: ${outstanding.toFixed(2)}`, `المتبقي: ${outstanding.toFixed(2)}`)} error={val > outstanding + 0.005 ? L('More than the outstanding balance', 'أكبر من الرصيد المتبقي') : undefined}>
          {(fid) => <Input id={fid} type="number" step="0.01" min={0} value={amount} placeholder={suggested.toFixed(2)} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} className="tabular" />}
        </Field>
        <Field label={L('Date received', 'تاريخ الاستلام')}>{(fid) => <Input id={fid} type="date" value={d} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setD(e.target.value)} />}</Field>
        <Field label={L('Method', 'الطريقة')} className="sm:col-span-2">{(fid) => <Select id={fid} value={method} onChange={(e) => setMethod(e.target.value as PaymentRecord['method'])}>{(['bank', 'instapay', 'cheque', 'cash', 'card'] as const).map((m) => <option key={m} value={m}>{lb.method(m)}</option>)}</Select>}</Field>
      </div>
    </Modal>
  );
}
