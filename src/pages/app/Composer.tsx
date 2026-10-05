import {
  AlertTriangle, ArrowLeft, Braces, CalendarRange, CheckCircle2, ChevronDown, Info, Layers, Plus, Repeat, Send, Trash2, UserPlus, XCircle, Zap, Percent, Usb,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { addPeriods, buildInstallments, dueDate, recurringRuns, type Frequency, type PaymentPlan, type PaymentTerms } from '@/billing/schedules';
import { computeLine, type DraftTax } from '@/eta/calc';
import { ACTIVITY_CODES, COUNTRIES, CURRENCIES, GOVERNORATES, TAX_TYPES, taxType } from '@/eta/codes';
import { documentHash, serializeForSigning } from '@/eta/serialize';
import type { DocumentTypeCode, PartyType } from '@/eta/types';
import { preflight, type Issue } from '@/eta/validate';
import { bi, useI18n } from '@/i18n';
import { computeDoc, toEtaDocument, uid, type Customer, type Doc, type DocLine } from '@/store/model';
import { useActions, useStore } from '@/store/store';
import {
  Button, Callout, Card, Field, Input, Modal, Mono, PageHeader, Segmented, Select, Table, Td, Textarea, Th, cx, useToast,
} from '@/components/ui';
import { UnitOptions, useLabels } from './shared';

const today = () => new Date().toISOString().slice(0, 10);
const localDT = (iso: string) => { const d = new Date(iso); const off = d.getTimezoneOffset(); return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16); };

function blankLine(): DocLine {
  return { description: '', itemType: 'EGS', itemCode: '', unitType: 'EA', quantity: 1, unitPrice: 0, currency: 'EGP', discountRate: 0, taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }] };
}

export function Composer() {
  const { db, set, mode } = useStore();
  const actions = useActions();
  const { L, lang, money, date } = useI18n();
  const lb = useLabels();
  const nav = useNavigate();
  const toast = useToast();
  const { id } = useParams();
  const [params] = useSearchParams();

  const [doc, setDoc] = useState<Doc>(() => {
    const existing = id ? db.docs.find((d) => d.id === id) : undefined;
    if (existing) return structuredClone(existing);
    const type = (params.get('type') as DocumentTypeCode) || 'I';
    const ref = params.get('ref') ? db.docs.find((d) => d.id === params.get('ref')) : undefined;
    const base: Doc = {
      id: uid('d'), direction: 'sent', documentType: type, internalID: actions.nextNumber(type), status: 'Draft',
      counterparty: { type: type.startsWith('E') ? 'F' : 'B' }, branchId: db.company.branches[0].id, activityCode: db.company.activityCode,
      issuedAt: new Date().toISOString(), lines: [blankLine()], extraDiscount: 0, plan: { kind: 'one-time', terms: db.settings.defaultTerms },
      payments: [], events: [{ at: new Date().toISOString(), type: 'created', by: db.session.user.name }],
    };
    if (ref) {
      Object.assign(base, { counterparty: ref.counterparty, customerId: ref.customerId, branchId: ref.branchId, references: [ref.uuid!], lines: structuredClone(ref.lines), plan: { kind: 'one-time', terms: 'receipt' } });
      base.events[0].note = `${type === 'C' ? 'Credit' : 'Debit'} against ${ref.internalID}`;
    }
    return base;
  });
  const [newCustomer, setNewCustomer] = useState(false);
  const [taxLine, setTaxLine] = useState<number | null>(null);
  const [showJson, setShowJson] = useState(false);
  const [more, setMore] = useState(!!(doc.poRef || doc.notes || doc.extraDiscount));
  const [busy, setBusy] = useState<'' | 'save' | 'submit'>('');
  const [touched, setTouched] = useState(false);

  const editable = doc.status === 'Draft';
  useEffect(() => { if (id && !editable) nav(`/app/documents/${id}`, { replace: true }); }, [id, editable, nav]);

  const patch = (p: Partial<Doc>) => setDoc((d) => ({ ...d, ...p }));
  const patchLine = (i: number, p: Partial<DocLine>) => setDoc((d) => ({ ...d, lines: d.lines.map((l, k) => (k === i ? { ...l, ...p } : l)) }));

  const { lines: computed, totals } = useMemo(() => computeDoc(doc), [doc]);
  const eta = useMemo(() => toEtaDocument(doc, db.company), [doc, db.company]);
  const existingIds = useMemo(() => db.docs.filter((d) => d.direction === 'sent' && d.id !== doc.id && d.status !== 'Invalid').map((d) => d.internalID), [db.docs, doc.id]);
  const issues = useMemo(() => {
    const list: Issue[] = preflight(eta, { existingInternalIds: existingIds, personIdThreshold: db.settings.personIdThreshold });
    const unapproved = doc.lines.filter((l) => l.itemCode && db.items.find((i) => i.itemCode === l.itemCode)?.codeStatus !== 'Approved' && db.items.some((i) => i.itemCode === l.itemCode));
    for (const l of unapproved) list.push({ level: 'warning', field: 'itemCode', en: `${l.itemCode} is not approved by ETA yet — the document will come back Invalid.`, ar: `الكود ${l.itemCode} غير معتمد بعد — سيعود المستند غير صالح.` });
    if (doc.plan.kind === 'recurring' && doc.plan.end.type === 'on' && doc.plan.end.date < doc.plan.startDate) list.push({ level: 'error', field: 'plan', en: 'Recurring end date is before the start date.', ar: 'تاريخ انتهاء التكرار قبل تاريخ البدء.' });
    return list;
  }, [eta, existingIds, doc.lines, doc.plan, db.items, db.settings.personIdThreshold]);
  const errors = issues.filter((i) => i.level === 'error');
  const foreign = doc.lines.some((l) => l.currency !== 'EGP');
  const isNote = ['C', 'D'].includes(doc.documentType);
  const customer = db.customers.find((c) => c.id === doc.customerId);
  // A server-held test certificate is always available; on the server, documents for an offline USB signer queue until it reconnects.
  const signerOnline = db.signing.method === 'test-certificate' || db.signing.agent.status === 'online' || mode === 'api';
  const signerQueued = mode === 'api' && db.signing.method !== 'test-certificate' && db.signing.agent.status !== 'online';

  const pickCustomer = (c?: Customer) => {
    if (!c) return patch({ customerId: undefined, counterparty: { type: 'P' } });
    patch({
      customerId: c.id, counterparty: { type: c.type, id: c.taxId, name: c.name, address: c.address },
      plan: doc.plan.kind === 'one-time' ? { kind: 'one-time', terms: c.terms } : doc.plan,
      lines: c.currency !== 'EGP' ? doc.lines.map((l) => ({ ...l, currency: l.unitPrice ? l.currency : c.currency, exchangeRate: l.exchangeRate ?? 48.62 })) : doc.lines,
    });
  };

  const pickItem = (i: number, itemId: string) => {
    const it = db.items.find((x) => x.id === itemId);
    if (!it) return patchLine(i, { itemId: undefined });
    const exportDoc = doc.documentType.startsWith('E');
    patchLine(i, {
      itemId: it.id, description: bi(lang, { en: it.name, ar: it.nameAr }), itemType: it.itemType, itemCode: it.itemCode, internalCode: it.internalCode, unitType: it.unitType,
      unitPrice: it.price, currency: it.currency, exchangeRate: it.currency !== 'EGP' ? 48.62 : undefined,
      taxes: exportDoc ? [{ taxType: 'T1', subType: 'V001', rate: 0 }] : it.taxes.map((t) => ({ ...t })),
    });
  };

  const setType = (t: DocumentTypeCode) => {
    const cfgKey = t === 'EC' || t === 'ED' ? 'EI' : t;
    setDoc((d) => ({
      ...d, documentType: t, internalID: id ? d.internalID : actions.nextNumber(cfgKey as DocumentTypeCode),
      counterparty: t.startsWith('E') && d.counterparty.type !== 'F' ? { type: 'F' } : d.counterparty,
      customerId: t.startsWith('E') && d.counterparty.type !== 'F' ? undefined : d.customerId,
      plan: t === 'C' || t === 'D' ? { kind: 'one-time', terms: 'receipt' } : d.plan,
    }));
  };

  const future = doc.plan.kind === 'recurring' && doc.plan.startDate > today();

  /** Saves the document. A recurring plan also creates the schedule; if it starts later, only the schedule is saved. */
  const persist = async (submitAfter: boolean): Promise<Doc | null> => {
    const now = new Date().toISOString();
    const final: Doc = { ...doc, issuedAt: doc.issuedAt > now ? now : doc.issuedAt };
    if (doc.plan.kind === 'recurring') {
      const p = doc.plan;
      const rid = uid('r');
      final.recurringId = rid;
      final.plan = { kind: 'one-time', terms: p.terms };
      const startsLater = p.startDate > today();
      set((x) => {
        x.recurring.unshift({
          id: rid, name: `${doc.counterparty.name ?? L('Customer', 'عميل')} — ${doc.lines[0]?.description || L('recurring invoice', 'فاتورة متكررة')}`, customerId: doc.customerId!, lines: structuredClone(doc.lines), branchId: doc.branchId,
          plan: p, status: 'active', generatedIds: startsLater ? [] : [final.id], lastRun: startsLater ? undefined : today(),
          nextRun: startsLater ? p.startDate : recurringRuns(p, 1, new Date(Date.now() + 86_400_000).toISOString().slice(0, 10))[0], createdAt: now,
        });
      });
      if (startsLater) {
        toast({ tone: 'ok', text: L(`Recurring invoice scheduled — first run ${date(p.startDate)}.`, `تمت جدولة الفاتورة المتكررة — أول إصدار ${date(p.startDate)}.`) });
        nav(`/app/recurring/${rid}`);
        return null;
      }
    }
    try { await actions.saveDoc(final); } catch { return null; }
    if (!submitAfter) toast({ tone: 'ok', text: L(`Draft ${final.internalID} saved.`, `تم حفظ المسودة ${final.internalID}.`) });
    return final;
  };

  const onSave = async () => { if (customerMissing()) return; setBusy('save'); const d = await persist(false); setBusy(''); if (d) nav(`/app/documents/${d.id}`); };
  const customerMissing = () => {
    if (doc.plan.kind === 'recurring' && !doc.customerId) { toast({ tone: 'bad', text: L('Recurring invoices need a saved customer.', 'الفواتير المتكررة تحتاج عميلاً محفوظاً.') }); return true; }
    return false;
  };
  const onSubmit = async () => {
    setTouched(true);
    if (errors.length) { toast({ tone: 'bad', text: L(`Fix ${errors.length} issue(s) before submitting.`, `أصلح ${errors.length} مشكلة قبل الإرسال.`) }); return; }
    if (customerMissing()) return;
    setBusy('submit');
    const d = await persist(true);
    if (!d) { setBusy(''); return; }
    nav(`/app/documents/${d.id}`);
    await actions.submit([d.id]);
  };

  const fieldErr = (f: string) => touched ? issues.find((i) => i.level === 'error' && i.field.startsWith(f))?.[lang] : undefined;
  const typeOptions: { value: DocumentTypeCode; label: string }[] = [
    { value: 'I', label: lb.docType('I') }, { value: 'C', label: lb.docType('C') }, { value: 'D', label: lb.docType('D') }, { value: 'EI', label: lb.docType('EI') },
  ];
  const refCandidates = db.docs.filter((d) => d.direction === 'sent' && d.status === 'Valid' && (d.documentType === 'I' || d.documentType === 'EI') && (!doc.customerId || d.customerId === doc.customerId));
  const customers = db.customers.filter((c) => (doc.documentType.startsWith('E') ? c.type === 'F' : true));

  return (
    <div className="animate-in">
      <PageHeader
        back={<Link to="/app/documents" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink mb-2"><ArrowLeft className="size-4 rtl:rotate-180" />{L('Invoices & notes', 'الفواتير والإشعارات')}</Link>}
        title={id ? L(`Edit ${doc.internalID}`, `تعديل ${doc.internalID}`) : L(`New ${lb.docType(doc.documentType).toLowerCase()}`, `${lb.docType(doc.documentType)} جديدة`)}
        description={L('Everything here maps 1:1 to the ETA v1.0 document. Totals use the official calculation rules.', 'كل حقل هنا يطابق مستند المصلحة الإصدار 1.0، والإجماليات بقواعد الحساب الرسمية.')}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] items-start">
        <div className="space-y-5 min-w-0">
          {/* Document */}
          <Card title={L('Document', 'المستند')}>
            <Segmented value={doc.documentType} onChange={setType} options={typeOptions} className="w-full sm:w-auto mb-5 flex-wrap" />
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
              <Field label={L('Internal number', 'الرقم الداخلي')} error={fieldErr('internalID')}>
                {(fid) => <Input id={fid} value={doc.internalID} onChange={(e) => patch({ internalID: e.target.value })} aria-invalid={!!fieldErr('internalID')} />}
              </Field>
              <Field label={L('Issue date & time', 'تاريخ ووقت الإصدار')} error={fieldErr('dateTimeIssued')} hint={L('Sent to ETA in UTC', 'يُرسل بتوقيت UTC')}>
                {(fid) => <Input id={fid} type="datetime-local" max={localDT(new Date().toISOString())} value={localDT(doc.issuedAt)} onChange={(e) => e.target.value && patch({ issuedAt: new Date(e.target.value).toISOString() })} />}
              </Field>
              <Field label={L('Issuing branch', 'الفرع المُصدِر')}>
                {(fid) => <Select id={fid} value={doc.branchId} onChange={(e) => patch({ branchId: e.target.value })}>{db.company.branches.map((b) => <option key={b.id} value={b.id}>{bi(lang, { en: b.name, ar: b.nameAr })} ({b.code})</option>)}</Select>}
              </Field>
              <Field label={L('Activity code', 'كود النشاط')}>
                {(fid) => <Select id={fid} value={doc.activityCode} onChange={(e) => patch({ activityCode: e.target.value })}>{ACTIVITY_CODES.map((a) => <option key={a.code} value={a.code}>{a.code} · {bi(lang, a)}</option>)}</Select>}
              </Field>
            </div>
          </Card>

          {/* Customer */}
          <Card title={L('Customer', 'العميل')} action={<Button size="sm" variant="quiet" icon={<UserPlus className="size-4" />} onClick={() => setNewCustomer(true)}>{L('New customer', 'عميل جديد')}</Button>}>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] items-start">
              <Field label={L('Bill to', 'إصدار إلى')} error={fieldErr('receiver')}>
                {(fid) => (
                  <Select id={fid} value={doc.customerId ?? (doc.counterparty.type === 'P' && !doc.customerId ? '__walkin' : '')} aria-invalid={!!fieldErr('receiver')}
                    onChange={(e) => e.target.value === '__walkin' ? pickCustomer(undefined) : pickCustomer(db.customers.find((c) => c.id === e.target.value))}>
                    <option value="" disabled>{L('Choose a customer…', 'اختر عميلاً…')}</option>
                    {!doc.documentType.startsWith('E') && <option value="__walkin">{L('Walk-in individual (no ID, below threshold)', 'فرد نقدي (بدون رقم قومي، أقل من الحد)')}</option>}
                    {(['B', 'P', 'F'] as PartyType[]).map((t) => {
                      const list = customers.filter((c) => c.type === t);
                      return list.length ? <optgroup key={t} label={lb.party(t)}>{list.map((c) => <option key={c.id} value={c.id}>{bi(lang, { en: c.name, ar: c.nameAr ?? c.name })}</option>)}</optgroup> : null;
                    })}
                  </Select>
                )}
              </Field>
            </div>
            {customer && (
              <div className="mt-4 grid gap-3 sm:grid-cols-3 rounded-md bg-sunken/60 border border-line p-3.5 text-[13px]">
                <div><div className="text-ink-subtle text-[12px]">{lb.partyId(customer.type)}</div><Mono>{customer.taxId}</Mono></div>
                <div className="sm:col-span-2"><div className="text-ink-subtle text-[12px]">{L('Address', 'العنوان')}</div>{customer.address.buildingNumber} {customer.address.street}, {customer.address.regionCity}, {customer.address.governate} · {customer.address.country}</div>
              </div>
            )}
            {doc.counterparty.type === 'P' && (
              <p className="mt-3 text-[12.5px] text-ink-muted flex gap-1.5"><Info className="size-4 shrink-0 text-info" />
                {L(`Individuals need a 14-digit national ID when the total reaches ${money(db.settings.personIdThreshold)}.`, `يلزم الرقم القومي للأفراد عند بلوغ الإجمالي ${money(db.settings.personIdThreshold)}.`)}</p>
            )}
            {isNote && (
              <div className="mt-5">
                <Field label={L('Original invoice', 'الفاتورة الأصلية')} error={fieldErr('references')} hint={L('Credit and debit notes must reference the ETA UUID of the invoice they adjust.', 'يجب أن يشير الإشعار إلى رقم UUID للفاتورة الأصلية.')}>
                  {(fid) => (
                    <Select id={fid} value={doc.references?.[0] ?? ''} onChange={(e) => patch({ references: e.target.value ? [e.target.value] : [] })} aria-invalid={!!fieldErr('references')}>
                      <option value="">{L('Select the invoice…', 'اختر الفاتورة…')}</option>
                      {refCandidates.map((d) => <option key={d.id} value={d.uuid}>{d.internalID} · {d.counterparty.name} · {date(d.issuedAt)}</option>)}
                    </Select>
                  )}
                </Field>
              </div>
            )}
          </Card>

          {/* Lines */}
          <Card title={L('Line items', 'البنود')} subtitle={L('Pick from your catalog to fill the ETA item code, unit and taxes.', 'اختر من الأصناف لتعبئة الكود والوحدة والضرائب.')} pad={false}>
            <div className="divide-y divide-line border-t border-line">
              {doc.lines.map((l, i) => {
                const c = computed[i];
                const err = (f: string) => touched && issues.some((x) => x.level === 'error' && x.field === `invoiceLines[${i}].${f}`);
                return (
                  <div key={i} className="p-4 sm:p-5 grid gap-3">
                    <div className="grid gap-3 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)_auto] items-end">
                      <Field label={L(`Item ${i + 1}`, `الصنف ${i + 1}`)}>
                        {(fid) => (
                          <Select id={fid} value={l.itemId ?? ''} onChange={(e) => pickItem(i, e.target.value)}>
                            <option value="">{L('Custom line…', 'بند مخصص…')}</option>
                            {db.items.map((it) => <option key={it.id} value={it.id} disabled={it.codeStatus === 'Rejected'}>{bi(lang, { en: it.name, ar: it.nameAr })}{it.codeStatus !== 'Approved' ? ` (${it.codeStatus})` : ''}</option>)}
                          </Select>
                        )}
                      </Field>
                      <Field label={L('Description', 'الوصف')}>
                        {(fid) => <Input id={fid} value={l.description} onChange={(e) => patchLine(i, { description: e.target.value })} aria-invalid={err('description')} placeholder={L('Shown on the ETA document', 'يظهر على مستند المصلحة')} />}
                      </Field>
                      <Button variant="ghost" className="justify-self-end" icon={<Trash2 className="size-4" />} disabled={doc.lines.length === 1} onClick={() => setDoc((d) => ({ ...d, lines: d.lines.filter((_, k) => k !== i) }))} aria-label={L('Remove line', 'حذف البند')} />
                    </div>
                    {!l.itemId && (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-[110px_minmax(0,1fr)]">
                        <Field label={L('Code type', 'نوع الكود')}>{(fid) => <Select id={fid} value={l.itemType} onChange={(e) => patchLine(i, { itemType: e.target.value as 'EGS' | 'GS1' })}><option>EGS</option><option>GS1</option></Select>}</Field>
                        <Field label={L('Item code', 'كود الصنف')}>{(fid) => <Input id={fid} dir="ltr" value={l.itemCode} onChange={(e) => patchLine(i, { itemCode: e.target.value })} placeholder={`EG-${db.company.rin}-…`} aria-invalid={err('itemCode')} />}</Field>
                      </div>
                    )}
                    <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-[90px_120px_minmax(0,150px)_90px_90px_minmax(0,1fr)]">
                      <Field label={L('Qty', 'الكمية')}>{(fid) => <Input id={fid} type="number" min={0} step="any" value={l.quantity} onChange={(e) => patchLine(i, { quantity: Number(e.target.value) })} aria-invalid={err('quantity')} className="tabular" />}</Field>
                      <Field label={L('Unit', 'الوحدة')}>{(fid) => <Select id={fid} value={l.unitType} onChange={(e) => patchLine(i, { unitType: e.target.value })}><UnitOptions /></Select>}</Field>
                      <Field label={L('Unit price', 'سعر الوحدة')}>{(fid) => <Input id={fid} type="number" min={0} step="any" value={l.unitPrice} onChange={(e) => patchLine(i, { unitPrice: Number(e.target.value) })} aria-invalid={err('unitValue')} className="tabular" />}</Field>
                      <Field label={L('Currency', 'العملة')}>{(fid) => <Select id={fid} value={l.currency} onChange={(e) => patchLine(i, { currency: e.target.value, exchangeRate: e.target.value === 'EGP' ? undefined : l.exchangeRate ?? 48.62 })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
                      <Field label={L('Disc. %', 'خصم %')}>{(fid) => <Input id={fid} type="number" min={0} max={100} step="any" value={l.discountRate ?? 0} onChange={(e) => patchLine(i, { discountRate: Number(e.target.value) })} className="tabular" />}</Field>
                      <div>
                        <span className="label">{L('Taxes', 'الضرائب')}</span>
                        <button type="button" onClick={() => setTaxLine(i)} className="input flex items-center gap-1.5 overflow-hidden text-start hover:border-accent">
                          <Percent className="size-3.5 text-ink-subtle shrink-0" />
                          <span className="truncate text-[13px]">{l.taxes.length ? l.taxes.map((t) => `${t.taxType} ${taxType(t.taxType)?.subTypes.find((s) => s.code === t.subType)?.fixed ? money(t.amount ?? 0) : `${t.rate}%`}`).join(' · ') : L('No taxes', 'بدون ضرائب')}</span>
                        </button>
                      </div>
                    </div>
                    {l.currency !== 'EGP' && (
                      <div className="grid gap-3 grid-cols-2 sm:grid-cols-[180px_minmax(0,1fr)] items-end">
                        <Field label={L(`EGP per 1 ${l.currency}`, `جنيه لكل 1 ${l.currency}`)} error={err('unitValue.currencyExchangeRate') ? L('Required', 'مطلوب') : undefined}>
                          {(fid) => <Input id={fid} type="number" step="any" value={l.exchangeRate ?? ''} onChange={(e) => patchLine(i, { exchangeRate: Number(e.target.value) })} className="tabular" />}
                        </Field>
                        <p className="text-[12.5px] text-ink-subtle pb-2">{L('ETA records amounts in EGP and keeps the sold currency on each line.', 'تسجل المصلحة المبالغ بالجنيه مع الاحتفاظ بعملة البيع.')}</p>
                      </div>
                    )}
                    <div className="flex flex-wrap justify-end gap-x-5 gap-y-1 text-[12.5px] text-ink-muted tabular">
                      <span>{L('Net', 'الصافي')} <span className="text-ink">{money(c.netTotal)}</span></span>
                      {c.taxableItems.map((t, k) => <span key={k}>{t.taxType} <span className={cx(t.taxType === 'T4' ? 'text-bad' : 'text-ink')}>{t.taxType === 'T4' ? '−' : ''}{money(t.amount)}</span></span>)}
                      <span className="font-semibold text-ink">{L('Line total', 'إجمالي البند')} {money(c.total)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="p-4 border-t border-line">
              <Button icon={<Plus className="size-4" />} onClick={() => setDoc((d) => ({ ...d, lines: [...d.lines, blankLine()] }))}>{L('Add line', 'إضافة بند')}</Button>
            </div>
          </Card>

          {/* Payment plan */}
          {!isNote && <PlanEditor doc={doc} total={totals.totalAmount} onChange={(plan) => patch({ plan })} />}

          {/* More */}
          <Card>
            <button type="button" className="flex w-full items-center justify-between text-start" onClick={() => setMore((m) => !m)} aria-expanded={more}>
              <span><span className="font-semibold text-ink">{L('More details', 'تفاصيل إضافية')}</span><span className="block text-[12.5px] text-ink-subtle">{L('PO reference, notes printed on the invoice, document-level discount', 'رقم أمر الشراء، ملاحظات، خصم على مستوى المستند')}</span></span>
              <ChevronDown className={cx('size-5 text-ink-subtle transition-transform', more && 'rotate-180')} />
            </button>
            {more && (
              <div className="grid gap-4 sm:grid-cols-2 mt-5">
                <Field label={L('Purchase order reference', 'مرجع أمر الشراء')} optional>{(fid) => <Input id={fid} value={doc.poRef ?? ''} onChange={(e) => patch({ poRef: e.target.value })} />}</Field>
                <Field label={L('Extra discount (EGP, after tax)', 'خصم إضافي (بعد الضريبة)')} optional hint={L('Non-taxable discount on the whole document.', 'خصم غير خاضع على المستند بالكامل.')}>
                  {(fid) => <Input id={fid} type="number" min={0} step="any" value={doc.extraDiscount} onChange={(e) => patch({ extraDiscount: Number(e.target.value) })} className="tabular" />}
                </Field>
                <Field label={L('Payment terms / notes', 'شروط الدفع / ملاحظات')} optional className="sm:col-span-2">{(fid) => <Textarea id={fid} value={doc.notes ?? ''} onChange={(e) => patch({ notes: e.target.value })} placeholder={L('Printed on the PDF and sent as payment.terms', 'تُطبع على الفاتورة وتُرسل في شروط الدفع')} />}</Field>
              </div>
            )}
          </Card>
        </div>

        {/* Summary rail */}
        <aside className="xl:sticky xl:top-[88px] space-y-4">
          <Card title={L('Summary', 'الملخص')}>
            <dl className="space-y-2 text-[13.5px] tabular">
              <Row k={L('Sales total', 'إجمالي المبيعات')} v={money(totals.totalSalesAmount)} />
              {totals.totalDiscountAmount > 0 && <Row k={L('Discounts', 'الخصومات')} v={`−${money(totals.totalDiscountAmount)}`} />}
              <Row k={L('Net amount', 'صافي المبلغ')} v={money(totals.netAmount)} />
              {totals.taxTotals.map((t) => (
                <Row key={t.taxType} k={<span>{t.taxType} · {bi(lang, taxType(t.taxType) ?? { en: '', ar: '' })}</span>} v={`${t.taxType === 'T4' ? '−' : ''}${money(t.amount)}`} tone={t.taxType === 'T4' ? 'bad' : undefined} />
              ))}
              {totals.extraDiscountAmount > 0 && <Row k={L('Extra discount', 'خصم إضافي')} v={`−${money(totals.extraDiscountAmount)}`} />}
            </dl>
            <div className="mt-4 pt-4 border-t border-line flex items-baseline justify-between">
              <span className="font-semibold text-ink">{L('Total', 'الإجمالي')}</span>
              <span className="text-[24px] font-semibold tabular text-ink">{money(totals.totalAmount)}</span>
            </div>
            {foreign && <p className="mt-1 text-[12px] text-ink-subtle">{L('All ETA totals are in EGP.', 'كل إجماليات المصلحة بالجنيه.')}</p>}
          </Card>

          <Card title={L('Pre-flight check', 'الفحص قبل الإرسال')} subtitle={touched || !errors.length ? L('The same rules ETA validates — caught before signing.', 'نفس قواعد تحقق المصلحة — قبل التوقيع.') : L(`${errors.length} things left before you can submit`, `${errors.length} عناصر متبقية قبل الإرسال`)}>
            {issues.length === 0 ? (
              <div className="flex items-center gap-2 text-ok font-medium"><CheckCircle2 className="size-[18px]" />{L('Ready to sign and submit', 'جاهزة للتوقيع والإرسال')}</div>
            ) : (
              <ul className="space-y-2">
                {issues.map((x, k) => (
                  <li key={k} className="flex gap-2 text-[13px]">
                    {x.level === 'error' ? (touched ? <XCircle className="size-4 text-bad shrink-0 mt-0.5" /> : <span className="size-3.5 mt-[3px] mx-px rounded-full border-[1.5px] border-ink-subtle shrink-0" />) : <AlertTriangle className="size-4 text-warn shrink-0 mt-0.5" />}
                    <span className={x.level === 'error' && touched ? 'text-ink' : 'text-ink-muted'}>{x[lang]}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="card p-4 space-y-3">
            {!signerOnline && <Callout tone="warn" title={L('Signer offline', 'التوقيع غير متصل')}>{L('You can save a draft; submission needs the USB token.', 'يمكنك حفظ مسودة؛ الإرسال يحتاج التوكن.')}</Callout>}
            {signerQueued && <Callout tone="info" title={L('Signer offline', 'التوقيع غير متصل')}>{L('Submitted documents wait in the signing queue and go to ETA as soon as Fatura Signer reconnects.', 'تنتظر المستندات في قائمة التوقيع وتُرسل فور اتصال برنامج التوقيع.')}</Callout>}
            <Button variant="primary" size="lg" className="w-full" icon={<Send className="size-4" />} onClick={onSubmit} loading={busy === 'submit'} disabled={(!signerOnline && !future) || !!busy}>
              {future ? L('Schedule recurring invoice', 'جدولة الفاتورة المتكررة') : L('Sign & submit to ETA', 'توقيع وإرسال للمصلحة')}
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={onSave} loading={busy === 'save'} disabled={!!busy}>{L('Save draft', 'حفظ مسودة')}</Button>
              <Button icon={<Braces className="size-4" />} onClick={() => setShowJson(true)}>{L('ETA JSON', 'JSON')}</Button>
            </div>
            <p className="flex items-center gap-1.5 text-[12px] text-ink-subtle"><Usb className="size-3.5" />{L(`Signed on ${db.signing.agent.host} with ${db.signing.certificate.issuer}`, `يُوقَّع على ${db.signing.agent.host} بشهادة ${db.signing.certificate.issuer}`)}</p>
          </div>
        </aside>
      </div>

      <div className="xl:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/95 backdrop-blur px-4 py-3 flex items-center gap-3 shadow-pop">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] text-ink-subtle">{L('Total', 'الإجمالي')}{errors.length ? ` · ${L(`${errors.length} to fix`, `${errors.length} للإصلاح`)}` : ''}</div>
          <div className="font-semibold tabular text-[17px] truncate">{money(totals.totalAmount)}</div>
        </div>
        <Button onClick={onSave} disabled={!!busy}>{L('Save', 'حفظ')}</Button>
        <Button variant="primary" icon={<Send className="size-4" />} onClick={onSubmit} loading={busy === 'submit'} disabled={(!signerOnline && !future) || !!busy}>{future ? L('Schedule', 'جدولة') : L('Submit', 'إرسال')}</Button>
      </div>
      <div className="h-20 xl:hidden" aria-hidden />

      {taxLine !== null && <TaxEditor taxes={doc.lines[taxLine].taxes} onClose={() => setTaxLine(null)} onSave={(taxes) => { patchLine(taxLine, { taxes }); setTaxLine(null); }} />}
      {newCustomer && <NewCustomer exportOnly={doc.documentType.startsWith('E')} onClose={() => setNewCustomer(false)} onCreate={(c) => { set((x) => { x.customers.unshift(c); }); pickCustomer(c); setNewCustomer(false); }} />}
      <JsonPreview open={showJson} onClose={() => setShowJson(false)} doc={{ ...eta, invoiceLines: computed }} />
    </div>
  );
}

function Row({ k, v, tone }: { k: React.ReactNode; v: string; tone?: 'bad' }) {
  return <div className="flex justify-between gap-3"><dt className="text-ink-muted min-w-0 truncate">{k}</dt><dd className={cx('whitespace-nowrap', tone === 'bad' ? 'text-bad' : 'text-ink')}>{v}</dd></div>;
}

/* ---------- Payment plan ---------- */
function PlanEditor({ doc, total, onChange }: { doc: Doc; total: number; onChange(p: PaymentPlan): void }) {
  const { L, money, date } = useI18n();
  const lb = useLabels();
  const p = doc.plan;
  const kind = doc.recurringId && p.kind === 'one-time' ? 'one-time' : p.kind;
  const switchTo = (k: PaymentPlan['kind']) => {
    const terms: PaymentTerms = p.kind === 'installments' ? 'net30' : p.terms;
    if (k === 'one-time') onChange({ kind: 'one-time', terms });
    if (k === 'recurring') onChange({ kind: 'recurring', frequency: 'monthly', interval: 1, startDate: today(), end: { type: 'never' }, delivery: 'submit_email', terms });
    if (k === 'installments') onChange({ kind: 'installments', count: 3, frequency: 'monthly', firstDueDate: today(), downPaymentPct: 0 });
  };
  const termsOpts = (['receipt', 'net15', 'net30', 'net45', 'net60'] as PaymentTerms[]).map((t) => <option key={t} value={t}>{lb.terms(t)}</option>);
  const freqOpts = (['weekly', 'monthly', 'quarterly', 'yearly'] as Frequency[]).map((f) => <option key={f} value={f}>{lb.freq(f)}</option>);

  return (
    <Card title={L('How will the customer pay?', 'كيف سيدفع العميل؟')} subtitle={L('ETA only receives the tax document. The plan drives reminders, receivables and future invoices.', 'المصلحة تستلم المستند الضريبي فقط. الخطة تتحكم في التذكيرات والمستحقات والفواتير القادمة.')}>
      <div role="radiogroup" className="grid gap-2 sm:grid-cols-3 mb-5">
        {([
          ['one-time', <Zap key="z" className="size-4" />, L('One payment', 'دفعة واحدة'), L('A single due date', 'تاريخ استحقاق واحد')],
          ['recurring', <Repeat key="r" className="size-4" />, L('Recurring', 'متكررة'), L('Issue this invoice on a schedule', 'إصدار الفاتورة دورياً')],
          ['installments', <Layers key="l" className="size-4" />, L('Installments', 'أقساط'), L('One invoice, paid over time', 'فاتورة واحدة تُدفع على أقساط')],
        ] as const).map(([k, icon, title, sub]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => switchTo(k)}
            className={cx('text-start rounded-md border p-3 transition-colors', kind === k ? 'border-accent bg-accent-soft/60 ring-1 ring-accent' : 'border-line hover:border-ink-subtle/50 bg-surface')}>
            <span className={cx('flex items-center gap-2 font-semibold', kind === k ? 'text-accent' : 'text-ink')}>{icon}{title}</span>
            <span className="block mt-0.5 text-[12.5px] text-ink-muted">{sub}</span>
          </button>
        ))}
      </div>

      {p.kind === 'one-time' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('Payment terms', 'شروط الدفع')}>{(fid) => <Select id={fid} value={p.terms} onChange={(e) => onChange({ ...p, terms: e.target.value as PaymentTerms })}>{termsOpts}</Select>}</Field>
          <div className="sm:pt-6 text-ink-muted">{L('Due', 'تستحق')} <span className="font-medium text-ink">{date(dueDate(doc.issuedAt.slice(0, 10), p.terms), 'long')}</span></div>
        </div>
      )}

      {p.kind === 'recurring' && (() => {
        const runs = recurringRuns(p, 6);
        return (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={L('Repeat', 'التكرار')}>{(fid) => <Select id={fid} value={p.frequency} onChange={(e) => onChange({ ...p, frequency: e.target.value as Frequency })}>{freqOpts}</Select>}</Field>
              <Field label={L('Every', 'كل')}>{(fid) => <Input id={fid} type="number" min={1} max={12} value={p.interval} onChange={(e) => onChange({ ...p, interval: Math.max(1, Number(e.target.value)) })} />}</Field>
              <Field label={L('First invoice', 'أول فاتورة')}>{(fid) => <Input id={fid} type="date" value={p.startDate} min={today()} onChange={(e) => onChange({ ...p, startDate: e.target.value })} />}</Field>
              <Field label={L('Payment terms', 'شروط الدفع')}>{(fid) => <Select id={fid} value={p.terms} onChange={(e) => onChange({ ...p, terms: e.target.value as PaymentTerms })}>{termsOpts}</Select>}</Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={L('Ends', 'ينتهي')}>
                {(fid) => (
                  <div className="flex gap-2">
                    <Select id={fid} value={p.end.type} className="flex-1" onChange={(e) => onChange({ ...p, end: e.target.value === 'never' ? { type: 'never' } : e.target.value === 'after' ? { type: 'after', count: 12 } : { type: 'on', date: addPeriods(p.startDate, 'yearly', 1) } })}>
                      <option value="never">{L('Never', 'أبداً')}</option><option value="after">{L('After a number of invoices', 'بعد عدد من الفواتير')}</option><option value="on">{L('On a date', 'في تاريخ')}</option>
                    </Select>
                    {p.end.type === 'after' && <Input type="number" min={1} className="w-24" aria-label={L('Invoices', 'الفواتير')} value={p.end.count} onChange={(e) => onChange({ ...p, end: { type: 'after', count: Math.max(1, Number(e.target.value)) } })} />}
                    {p.end.type === 'on' && <Input type="date" className="w-44" aria-label={L('End date', 'تاريخ الانتهاء')} value={p.end.date} onChange={(e) => onChange({ ...p, end: { type: 'on', date: e.target.value } })} />}
                  </div>
                )}
              </Field>
              <Field label={L('When each invoice is created', 'عند إنشاء كل فاتورة')}>
                {(fid) => (
                  <Select id={fid} value={p.delivery} onChange={(e) => onChange({ ...p, delivery: e.target.value as typeof p.delivery })}>
                    <option value="draft">{L('Save as draft for my approval', 'حفظ كمسودة لاعتمادي')}</option>
                    <option value="submit">{L('Sign & submit to ETA automatically', 'توقيع وإرسال تلقائي للمصلحة')}</option>
                    <option value="submit_email">{L('Submit to ETA and email the customer', 'إرسال للمصلحة وإرسال بريد للعميل')}</option>
                  </Select>
                )}
              </Field>
            </div>
            <div className="rounded-md border border-line bg-sunken/50 p-3.5">
              <div className="flex items-center gap-2 text-[13px] font-medium text-ink mb-2"><CalendarRange className="size-4 text-accent" />{L('Next invoices', 'الفواتير القادمة')}</div>
              <div className="flex flex-wrap gap-1.5">{runs.map((r) => <span key={r} className="px-2 h-6 inline-flex items-center rounded bg-surface border border-line text-[12.5px] tabular">{date(r)}</span>)}{runs.length === 0 && <span className="text-ink-muted text-[13px]">—</span>}</div>
              <p className="mt-2.5 text-[12.5px] text-ink-muted">{L('Each run issues a new ETA invoice dated that day — ETA rejects future-dated documents, so nothing is issued in advance. Auto-submit needs the signer online (or cloud/HSM signing).', 'كل دورة تُصدر فاتورة جديدة بتاريخ يومها — ترفض المصلحة المستندات المستقبلية. الإرسال التلقائي يحتاج وكيل التوقيع متصلاً.')}</p>
            </div>
          </div>
        );
      })()}

      {p.kind === 'installments' && (() => {
        const rows = buildInstallments(total, p);
        return (
          <div className="space-y-4">
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Field label={L('Installments', 'عدد الأقساط')}>{(fid) => <Select id={fid} value={p.count} onChange={(e) => onChange({ ...p, count: Number(e.target.value) })}>{[2, 3, 4, 6, 9, 12, 18, 24].map((n) => <option key={n} value={n}>{n}</option>)}</Select>}</Field>
              <Field label={L('Frequency', 'الدورية')}>{(fid) => <Select id={fid} value={p.frequency} onChange={(e) => onChange({ ...p, frequency: e.target.value as Frequency })}>{freqOpts}</Select>}</Field>
              <Field label={L('Down payment %', 'الدفعة المقدمة %')}>{(fid) => <Input id={fid} type="number" min={0} max={90} value={p.downPaymentPct} onChange={(e) => onChange({ ...p, downPaymentPct: Math.min(90, Math.max(0, Number(e.target.value))) })} />}</Field>
              <Field label={L('First due date', 'تاريخ أول استحقاق')}>{(fid) => <Input id={fid} type="date" value={p.firstDueDate} onChange={(e) => onChange({ ...p, firstDueDate: e.target.value })} />}</Field>
            </div>
            <Table className="rounded-md border border-line">
              <thead><tr><Th>#</Th><Th>{L('Due date', 'تاريخ الاستحقاق')}</Th><Th align="end">{L('Amount', 'المبلغ')}</Th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.n}><Td>{r.label === 'down' ? L('Down payment', 'دفعة مقدمة') : r.n}</Td><Td>{date(r.dueDate)}</Td><Td align="end">{money(r.amount)}</Td></tr>
                ))}
              </tbody>
            </Table>
            <p className="text-[12.5px] text-ink-muted flex gap-1.5"><Info className="size-4 shrink-0 text-info" />{L('ETA receives one invoice for the full amount — VAT is due when the invoice is issued, not as installments are collected. Fatura tracks the schedule and sends reminders.', 'تستلم المصلحة فاتورة واحدة بالمبلغ كاملاً — الضريبة مستحقة عند الإصدار. فاتورة تتابع الأقساط وترسل التذكيرات.')}</p>
          </div>
        );
      })()}
    </Card>
  );
}

/* ---------- Tax editor ---------- */
function TaxEditor({ taxes, onClose, onSave }: { taxes: DraftTax[]; onClose(): void; onSave(t: DraftTax[]): void }) {
  const { L, lang, money } = useI18n();
  const [rows, setRows] = useState<DraftTax[]>(() => structuredClone(taxes));
  const preview = computeLine({ description: '', itemType: 'EGS', itemCode: '', unitType: 'EA', quantity: 1, unitPrice: 1000, currency: 'EGP', taxes: rows });
  return (
    <Modal open onClose={onClose} title={L('Line taxes', 'ضرائب البند')} size="lg"
      footer={<><Button onClick={onClose}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" onClick={() => onSave(rows)}>{L('Apply', 'تطبيق')}</Button></>}>
      <div className="space-y-3">
        {rows.map((t, i) => {
          const tt = taxType(t.taxType)!;
          const sub = tt.subTypes.find((s) => s.code === t.subType) ?? tt.subTypes[0];
          return (
            <div key={i} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_120px_auto] items-end rounded-md border border-line p-3">
              <Field label={L('Tax type', 'نوع الضريبة')}>{(fid) => (
                <Select id={fid} value={t.taxType} onChange={(e) => { const n = taxType(e.target.value)!; const s = n.subTypes[0]; setRows((r) => r.map((x, k) => k === i ? { taxType: n.code, subType: s.code, rate: s.fixed ? 0 : s.defaultRate ?? 0, amount: s.fixed ? 0 : undefined } : x)); }}>
                  {TAX_TYPES.map((x) => <option key={x.code} value={x.code}>{x.code} · {bi(lang, x)}</option>)}
                </Select>
              )}</Field>
              <Field label={L('Subtype', 'النوع الفرعي')}>{(fid) => (
                <Select id={fid} value={t.subType} onChange={(e) => { const s = tt.subTypes.find((x) => x.code === e.target.value)!; setRows((r) => r.map((x, k) => k === i ? { ...x, subType: s.code, rate: s.fixed ? 0 : s.defaultRate ?? x.rate, amount: s.fixed ? x.amount ?? 0 : undefined } : x)); }}>
                  {tt.subTypes.map((s) => <option key={s.code} value={s.code}>{s.code} · {bi(lang, s)}</option>)}
                </Select>
              )}</Field>
              {sub.fixed
                ? <Field label={L('Amount (EGP)', 'المبلغ')}>{(fid) => <Input id={fid} type="number" min={0} step="any" value={t.amount ?? 0} onChange={(e) => setRows((r) => r.map((x, k) => k === i ? { ...x, amount: Number(e.target.value) } : x))} />}</Field>
                : <Field label={L('Rate %', 'النسبة %')}>{(fid) => <Input id={fid} type="number" min={0} step="any" value={t.rate} onChange={(e) => setRows((r) => r.map((x, k) => k === i ? { ...x, rate: Number(e.target.value) } : x))} />}</Field>}
              <Button variant="ghost" icon={<Trash2 className="size-4" />} aria-label={L('Remove tax', 'حذف الضريبة')} onClick={() => setRows((r) => r.filter((_, k) => k !== i))} />
            </div>
          );
        })}
        <Button icon={<Plus className="size-4" />} onClick={() => setRows((r) => [...r, { taxType: 'T4', subType: 'W004', rate: 3 }])}>{L('Add tax', 'إضافة ضريبة')}</Button>
        <div className="rounded-md bg-sunken/60 border border-line p-3 text-[12.5px] text-ink-muted">
          <div className="font-medium text-ink mb-1">{L('On 1,000.00 EGP net:', 'على صافي ١٠٠٠ جنيه:')}</div>
          {preview.taxableItems.map((t, k) => <span key={k} className="me-4 tabular">{t.taxType}/{t.subType}: {t.taxType === 'T4' ? '−' : ''}{money(t.amount)}</span>)}
          <span className="font-medium text-ink tabular">→ {money(preview.total)}</span>
          <p className="mt-1.5">{L('Table tax (T2/T3) and taxable fees (T5–T12) are added to the VAT base; withholding (T4) is deducted from the total.', 'ضريبة الجدول والرسوم الخاضعة تُضاف لوعاء القيمة المضافة؛ الخصم تحت حساب الضريبة يُخصم من الإجمالي.')}</p>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- New customer ---------- */
export function NewCustomer({ onClose, onCreate, exportOnly, initial }: { onClose(): void; onCreate(c: Customer): void; exportOnly?: boolean; initial?: Customer }) {
  const { L, lang } = useI18n();
  const lb = useLabels();
  const { db } = useStore();
  const [c, setC] = useState<Customer>(() => initial ?? {
    id: uid('c'), type: exportOnly ? 'F' : 'B', taxId: '', name: '', email: '', terms: db.settings.defaultTerms, currency: exportOnly ? 'USD' : 'EGP', createdAt: new Date().toISOString(),
    address: { country: exportOnly ? 'GB' : 'EG', governate: exportOnly ? '' : 'Cairo', regionCity: '', street: '', buildingNumber: '' },
  });
  const [lookup, setLookup] = useState<'idle' | 'busy' | 'found' | 'missing'>('idle');
  const addr = (p: Partial<Customer['address']>) => setC((x) => ({ ...x, address: { ...x.address, ...p } }));
  const idOk = c.type === 'B' ? /^\d{9}$/.test(c.taxId) : c.type === 'P' ? !c.taxId || /^[23]\d{13}$/.test(c.taxId) : true;
  const valid = c.name.trim() && idOk && (c.type !== 'B' || (c.address.street && c.address.regionCity));
  const verify = async () => {
    setLookup('busy');
    await new Promise((r) => setTimeout(r, 700));
    if (c.taxId.endsWith('000')) { setLookup('missing'); return; }
    setLookup('found');
    if (!c.name) setC((x) => ({ ...x, name: 'Registered taxpayer ' + x.taxId.slice(-4) }));
  };
  return (
    <Modal open onClose={onClose} title={initial ? L('Edit customer', 'تعديل العميل') : L('New customer', 'عميل جديد')} size="lg"
      footer={<><Button onClick={onClose}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" disabled={!valid} onClick={() => onCreate(c)}>{initial ? L('Save', 'حفظ') : L('Add customer', 'إضافة العميل')}</Button></>}>
      <div className="space-y-4">
        <Segmented value={c.type} onChange={(t) => setC((x) => ({ ...x, type: t, address: { ...x.address, country: t === 'F' ? (x.address.country === 'EG' ? 'GB' : x.address.country) : 'EG' } }))}
          options={(exportOnly ? ['F'] : ['B', 'P', 'F'] as PartyType[]).map((t) => ({ value: t as PartyType, label: lb.party(t as PartyType) }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={lb.partyId(c.type)} optional={c.type === 'P'} error={c.taxId && !idOk ? (c.type === 'B' ? L('9 digits', '٩ أرقام') : L('14 digits starting with 2 or 3', '١٤ رقماً تبدأ بـ ٢ أو ٣')) : undefined}
            hint={c.type === 'B' ? (lookup === 'found' ? <span className="text-ok">{L('Active registered taxpayer', 'ممول مسجل ونشط')}</span> : lookup === 'missing' ? <span className="text-bad">{L('Not found in the ETA taxpayer registry', 'غير موجود في سجل الممولين')}</span> : L('We check it against the ETA registry.', 'نتحقق منه في سجل المصلحة.')) : undefined}>
            {(fid) => (
              <div className="flex gap-2">
                <Input id={fid} dir="ltr" inputMode={c.type === 'F' ? 'text' : 'numeric'} value={c.taxId} onChange={(e) => { setLookup('idle'); setC((x) => ({ ...x, taxId: e.target.value.trim() })); }} aria-invalid={!!c.taxId && !idOk} />
                {c.type === 'B' && <Button onClick={verify} loading={lookup === 'busy'} disabled={!/^\d{9}$/.test(c.taxId)}>{L('Verify', 'تحقق')}</Button>}
              </div>
            )}
          </Field>
          <Field label={L('Legal name', 'الاسم القانوني')}>{(fid) => <Input id={fid} value={c.name} onChange={(e) => setC((x) => ({ ...x, name: e.target.value }))} />}</Field>
          <Field label={L('Name in Arabic', 'الاسم بالعربية')} optional>{(fid) => <Input id={fid} dir="rtl" value={c.nameAr ?? ''} onChange={(e) => setC((x) => ({ ...x, nameAr: e.target.value }))} />}</Field>
          <Field label={L('Billing email', 'بريد الفواتير')}>{(fid) => <Input id={fid} type="email" dir="ltr" value={c.email} onChange={(e) => setC((x) => ({ ...x, email: e.target.value }))} />}</Field>
          <Field label={L('Country', 'الدولة')}>{(fid) => <Select id={fid} value={c.address.country} disabled={c.type !== 'F'} onChange={(e) => addr({ country: e.target.value })}>{COUNTRIES.filter((x) => c.type === 'F' ? x.code !== 'EG' : true).map((x) => <option key={x.code} value={x.code}>{bi(lang, x)}</option>)}</Select>}</Field>
          <Field label={c.type === 'F' ? L('State / region', 'الولاية / المنطقة') : L('Governorate', 'المحافظة')}>
            {(fid) => c.type === 'F' ? <Input id={fid} value={c.address.governate} onChange={(e) => addr({ governate: e.target.value })} /> : <Select id={fid} value={c.address.governate} onChange={(e) => addr({ governate: e.target.value })}>{GOVERNORATES.map((g) => <option key={g}>{g}</option>)}</Select>}
          </Field>
          <Field label={L('City / district', 'المدينة / الحي')}>{(fid) => <Input id={fid} value={c.address.regionCity} onChange={(e) => addr({ regionCity: e.target.value })} />}</Field>
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3">
            <Field label={L('Street', 'الشارع')}>{(fid) => <Input id={fid} value={c.address.street} onChange={(e) => addr({ street: e.target.value })} />}</Field>
            <Field label={L('Building', 'المبنى')}>{(fid) => <Input id={fid} value={c.address.buildingNumber} onChange={(e) => addr({ buildingNumber: e.target.value })} />}</Field>
          </div>
          <Field label={L('Default payment terms', 'شروط الدفع الافتراضية')}>{(fid) => <Select id={fid} value={c.terms} onChange={(e) => setC((x) => ({ ...x, terms: e.target.value as PaymentTerms }))}>{(['receipt', 'net15', 'net30', 'net45', 'net60'] as PaymentTerms[]).map((t) => <option key={t} value={t}>{lb.terms(t)}</option>)}</Select>}</Field>
          <Field label={L('Invoice currency', 'عملة الفواتير')}>{(fid) => <Select id={fid} value={c.currency} onChange={(e) => setC((x) => ({ ...x, currency: e.target.value }))}>{CURRENCIES.map((x) => <option key={x}>{x}</option>)}</Select>}</Field>
        </div>
      </div>
    </Modal>
  );
}

/* ---------- JSON preview ---------- */
function JsonPreview({ open, onClose, doc }: { open: boolean; onClose(): void; doc: object }) {
  const { L } = useI18n();
  const [tab, setTab] = useState<'json' | 'canonical'>('json');
  const [hash, setHash] = useState('');
  useEffect(() => { if (open) documentHash(doc).then(setHash); }, [open, doc]);
  return (
    <Modal open={open} onClose={onClose} title={L('ETA document payload', 'حمولة مستند المصلحة')} size="lg">
      <Segmented<'json' | 'canonical'> value={tab} onChange={setTab} size="sm" className="mb-3" options={[{ value: 'json', label: 'JSON v1.0' }, { value: 'canonical', label: L('Canonical (signed)', 'الصيغة الموقعة') }]} />
      <pre dir="ltr" className="text-[12px] leading-relaxed font-mono bg-sunken border border-line rounded-md p-3 max-h-[52vh] overflow-auto whitespace-pre-wrap break-all">
        {tab === 'json' ? JSON.stringify(doc, null, 2) : serializeForSigning(doc)}
      </pre>
      <div className="mt-3 text-[12.5px] text-ink-muted">SHA-256 <Mono className="text-ink break-all">{hash}</Mono></div>
    </Modal>
  );
}
