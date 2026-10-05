import { Boxes, CheckCircle2, Clock, Plus, Search, Send, XCircle } from 'lucide-react';
import { useState } from 'react';
import { CURRENCIES, taxType } from '@/eta/codes';
import { UnitOptions } from './shared';
import type { CodeRequestStatus } from '@/eta/types';
import { bi, useI18n } from '@/i18n';
import { uid, type Item } from '@/store/model';
import { useActions, useStore } from '@/store/store';
import { Badge, Button, Callout, Card, EmptyState, Field, Input, Modal, Money, Mono, PageHeader, Segmented, Select, Table, Td, Th, useToast } from '@/components/ui';

export function CodeStatus({ s }: { s: CodeRequestStatus }) {
  const { L } = useI18n();
  if (s === 'Approved') return <Badge tone="ok" icon={<CheckCircle2 className="size-3" />}>{L('Approved', 'معتمد')}</Badge>;
  if (s === 'Submitted') return <Badge tone="info" icon={<Clock className="size-3" />}>{L('Pending ETA review', 'قيد المراجعة')}</Badge>;
  return <Badge tone="bad" icon={<XCircle className="size-3" />}>{L('Rejected', 'مرفوض')}</Badge>;
}

export function Items() {
  const { db, set } = useStore();
  const actions = useActions();
  const { L, lang, date } = useI18n();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [review, setReview] = useState(false);
  const rows = db.items.filter((i) => !q || `${i.name} ${i.nameAr} ${i.itemCode} ${i.internalCode}`.toLowerCase().includes(q.toLowerCase()));
  const registrable = sel.filter((id) => { const it = db.items.find((x) => x.id === id); return it?.itemType === 'EGS' && it.codeStatus !== 'Approved'; });

  return (
    <div className="animate-in">
      <PageHeader title={L('Items & codes', 'الأصناف والأكواد')}
        description={L('Every invoice line needs an item code ETA has approved for you: GS1 barcodes for retail goods, or your own EGS codes registered through the code-usage API.', 'كل بند يحتاج كوداً معتمداً من المصلحة: باركود GS1 أو أكواد EGS خاصة بك.')}
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setAdding(true)}>{L('New item', 'صنف جديد')}</Button>} />
      {db.items.some((i) => i.codeStatus === 'Rejected') && <div className="mb-5"><Callout tone="bad" title={L('Some codes were rejected', 'تم رفض بعض الأكواد')}>{L('Usually the GPC classification does not match the description. Edit and re-request — invoices using a rejected code come back Invalid.', 'غالباً لعدم تطابق تصنيف GPC مع الوصف. عدّل وأعد الطلب.')}</Callout></div>}
      <Card pad={false}>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative flex-1 min-w-[220px] max-w-[340px]"><Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Name or code', 'الاسم أو الكود')} aria-label={L('Search', 'بحث')} /></div>
          <div className="flex-1" />
          {sel.length > 0 && <Button variant="primary" icon={<Send className="size-4" />} disabled={!registrable.length} onClick={() => setReview(true)}>{L(`Request ${registrable.length} EGS code(s)`, `طلب ${registrable.length} كود EGS`)}</Button>}
        </div>
        {rows.length === 0 ? <EmptyState icon={<Boxes className="size-5" />} title={L('No items', 'لا توجد أصناف')} /> : (
          <Table>
            <thead><tr><Th className="w-10"><span className="sr-only">{L('Select', 'تحديد')}</span></Th><Th>{L('Item', 'الصنف')}</Th><Th>{L('ETA code', 'كود المصلحة')}</Th><Th>{L('Unit', 'الوحدة')}</Th><Th>{L('Taxes', 'الضرائب')}</Th><Th>{L('Code status', 'حالة الكود')}</Th><Th align="end">{L('Price', 'السعر')}</Th></tr></thead>
            <tbody>{rows.map((it) => (
              <tr key={it.id} className="hover:bg-sunken/50">
                <Td><input type="checkbox" className="size-4 accent-[rgb(var(--accent))]" aria-label={it.name} checked={sel.includes(it.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, it.id] : s.filter((x) => x !== it.id))} /></Td>
                <Td><div className="font-medium text-ink">{bi(lang, { en: it.name, ar: it.nameAr })}</div><div className="text-[12px] text-ink-subtle">{L('Internal', 'داخلي')} {it.internalCode} · GPC {it.gpcCode}</div></Td>
                <Td><Badge>{it.itemType}</Badge> <Mono className="ms-1">{it.itemCode}</Mono></Td>
                <Td>{it.unitType}</Td>
                <Td className="text-[12.5px] text-ink-muted whitespace-nowrap">{it.taxes.map((t) => `${t.taxType}/${t.subType} ${t.rate}%`).join(' · ')}</Td>
                <Td><CodeStatus s={it.codeStatus} /><div className="text-[11.5px] text-ink-subtle mt-0.5">{date(it.codeRequestedAt)}</div></Td>
                <Td align="end"><Money value={it.price} currency={it.currency} /></Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>

      <Modal open={review} onClose={() => setReview(false)} title={L('Request EGS code usage', 'طلب استخدام أكواد EGS')} size="lg"
        footer={<><Button onClick={() => setReview(false)}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" icon={<Send className="size-4" />} onClick={async () => { setReview(false); await actions.requestCodes(registrable); setSel([]); toast({ tone: 'ok', text: L('Sent to ETA. Approval usually takes 1–3 working days.', 'أُرسل للمصلحة. الاعتماد يستغرق عادة ١–٣ أيام عمل.') }); }}>{L('Submit to ETA', 'إرسال للمصلحة')}</Button></>}>
        <p className="text-ink-muted mb-4">{L('Sent with POST /api/v1.0/codetypes/requests/codes. ETA reviews each code against its GPC parent; you can use a code on invoices only once it is Approved.', 'يُرسل عبر واجهة طلب الأكواد. تراجع المصلحة كل كود مقابل تصنيف GPC.')}</p>
        <Table className="rounded-md border border-line">
          <thead><tr><Th>itemCode</Th><Th>parentCode</Th><Th>codeName / codeNameAr</Th><Th>activeFrom</Th></tr></thead>
          <tbody>{registrable.map((id) => { const it = db.items.find((x) => x.id === id)!; return <tr key={id}><Td><Mono>{it.itemCode}</Mono></Td><Td><Mono>{it.gpcCode}</Mono></Td><Td>{it.name}<div className="text-ink-muted" dir="rtl">{it.nameAr}</div></Td><Td>{date(new Date().toISOString())}</Td></tr>; })}</tbody>
        </Table>
      </Modal>

      {adding && <NewItem onClose={() => setAdding(false)} onCreate={(it) => { set((x) => { x.items.unshift(it); }); setAdding(false); toast({ tone: 'ok', text: it.itemType === 'EGS' ? L('Item saved — request its EGS code to use it on invoices.', 'تم حفظ الصنف — اطلب كود EGS لاستخدامه.') : L('Item saved.', 'تم حفظ الصنف.') }); }} />}
    </div>
  );
}

function NewItem({ onClose, onCreate }: { onClose(): void; onCreate(i: Item): void }) {
  const { db } = useStore();
  const { L, lang } = useI18n();
  const [it, setIt] = useState<Item>({ id: uid('i'), name: '', nameAr: '', itemType: 'EGS', itemCode: '', internalCode: '', gpcCode: '10005844', unitType: 'EA', price: 0, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }], codeStatus: 'Submitted', codeRequestedAt: new Date().toISOString() });
  const code = it.itemType === 'EGS' ? `EG-${db.company.rin}-${it.internalCode.toUpperCase()}` : it.itemCode;
  const ok = it.name && it.nameAr && (it.itemType === 'EGS' ? /^[A-Za-z0-9]{2,20}$/.test(it.internalCode) : /^\d{8,14}$/.test(it.itemCode));
  return (
    <Modal open onClose={onClose} title={L('New item', 'صنف جديد')} size="lg"
      footer={<><Button onClick={onClose}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" disabled={!ok} onClick={() => onCreate({ ...it, itemCode: code, codeStatus: it.itemType === 'GS1' ? 'Approved' : 'Submitted' })}>{L('Save item', 'حفظ الصنف')}</Button></>}>
      <div className="space-y-4">
        <Segmented value={it.itemType} onChange={(v) => setIt((x) => ({ ...x, itemType: v }))} options={[{ value: 'EGS', label: L('EGS — my own code', 'EGS — كود خاص') }, { value: 'GS1', label: L('GS1 — barcode', 'GS1 — باركود') }]} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={L('Name (English)', 'الاسم بالإنجليزية')}>{(fid) => <Input id={fid} value={it.name} onChange={(e) => setIt((x) => ({ ...x, name: e.target.value }))} />}</Field>
          <Field label={L('Name (Arabic)', 'الاسم بالعربية')} hint={L('ETA requires both names for EGS codes.', 'المصلحة تطلب الاسمين لأكواد EGS.')}>{(fid) => <Input id={fid} dir="rtl" value={it.nameAr} onChange={(e) => setIt((x) => ({ ...x, nameAr: e.target.value }))} />}</Field>
          {it.itemType === 'EGS' ? (
            <Field label={L('Internal code', 'الكود الداخلي')} hint={<>{L('Becomes', 'يصبح')} <Mono>{code}</Mono></>}>{(fid) => <Input id={fid} dir="ltr" value={it.internalCode} onChange={(e) => setIt((x) => ({ ...x, internalCode: e.target.value.replace(/\s/g, '') }))} placeholder="SUPP02" />}</Field>
          ) : (
            <Field label={L('GTIN barcode', 'الباركود')}>{(fid) => <Input id={fid} dir="ltr" inputMode="numeric" value={it.itemCode} onChange={(e) => setIt((x) => ({ ...x, itemCode: e.target.value.trim(), internalCode: e.target.value.trim() }))} placeholder="6221234500017" />}</Field>
          )}
          <Field label={L('GPC brick (parent code)', 'تصنيف GPC')}>{(fid) => <Input id={fid} dir="ltr" value={it.gpcCode} onChange={(e) => setIt((x) => ({ ...x, gpcCode: e.target.value }))} />}</Field>
          <Field label={L('Unit', 'الوحدة')}>{(fid) => <Select id={fid} value={it.unitType} onChange={(e) => setIt((x) => ({ ...x, unitType: e.target.value }))}><UnitOptions /></Select>}</Field>
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-3">
            <Field label={L('Default price', 'السعر الافتراضي')}>{(fid) => <Input id={fid} type="number" min={0} value={it.price} onChange={(e) => setIt((x) => ({ ...x, price: Number(e.target.value) }))} />}</Field>
            <Field label={L('Currency', 'العملة')}>{(fid) => <Select id={fid} value={it.currency} onChange={(e) => setIt((x) => ({ ...x, currency: e.target.value }))}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>}</Field>
          </div>
          <Field label={L('VAT treatment', 'معاملة الضريبة')} className="sm:col-span-2">{(fid) => (
            <Select id={fid} value={it.taxes[0]?.subType} onChange={(e) => { const s = taxType('T1')!.subTypes.find((x) => x.code === e.target.value)!; setIt((x) => ({ ...x, taxes: [{ taxType: 'T1', subType: s.code, rate: s.defaultRate ?? 0 }, ...x.taxes.slice(1)] })); }}>
              {taxType('T1')!.subTypes.map((s) => <option key={s.code} value={s.code}>{s.code} · {bi(lang, s)} ({s.defaultRate}%)</option>)}
            </Select>
          )}</Field>
        </div>
      </div>
    </Modal>
  );
}
