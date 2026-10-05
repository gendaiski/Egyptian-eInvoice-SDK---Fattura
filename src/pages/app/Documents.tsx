import { Download, FileText, Plus, Search, Send, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import type { DocStatus } from '@/eta/types';
import { useI18n } from '@/i18n';
import { docTotal, dueInfo, toEtaDocument } from '@/store/model';
import { useActions, useStore } from '@/store/store';
import { preflight, hasErrors } from '@/eta/validate';
import { saveTextFile } from '@/lib/files';
import {
  Button, Callout, Card, EmptyState, Input, LinkButton, Modal, Money, PageHeader, Select, StatusBadge, Table, Tabs, Td, Th, useToast, Mono,
} from '@/components/ui';
import { DueBadge, PlanBadge, useLabels } from './shared';

type TabKey = 'all' | 'Draft' | 'Submitted' | 'Valid' | 'Invalid' | 'closed';

export function Documents() {
  const { db } = useStore();
  const { submit } = useActions();
  const { L, date } = useI18n();
  const lb = useLabels();
  const toast = useToast();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('status') as TabKey) || 'all';
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [range, setRange] = useState('all');
  const [pay, setPay] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [limit, setLimit] = useState(25);
  const [importOpen, setImportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const sent = db.docs.filter((d) => d.direction === 'sent');
  const inTab = (s: DocStatus, t: TabKey) =>
    t === 'all' || (t === 'Submitted' ? s === 'Submitted' || s === 'Signing' : t === 'closed' ? s === 'Cancelled' || s === 'Rejected' : s === t);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    const since = range === 'all' ? '' : new Date(Date.now() - Number(range) * 86_400_000).toISOString();
    return sent.filter((d) => inTab(d.status, tab)
      && (!type || d.documentType === type)
      && (!since || d.issuedAt >= since)
      && (!pay || dueInfo(d).state === pay)
      && (!s || `${d.internalID} ${d.counterparty.name} ${d.counterparty.id} ${d.uuid ?? ''}`.toLowerCase().includes(s)));
  }, [sent, tab, q, type, range, pay]);

  const count = (t: TabKey) => sent.filter((d) => inTab(d.status, t)).length;
  const selectedDrafts = sel.filter((id) => sent.find((d) => d.id === id)?.status === 'Draft');
  const signerOffline = db.signing.agent.status !== 'online';

  const bulkSubmit = async () => {
    const ids = selectedDrafts;
    const blocked = ids.filter((id) => hasErrors(preflight(toEtaDocument(sent.find((d) => d.id === id)!, db.company), { personIdThreshold: db.settings.personIdThreshold })));
    const ok = ids.filter((id) => !blocked.includes(id));
    if (blocked.length) toast({ tone: 'bad', text: L(`${blocked.length} draft(s) have errors — open them to fix.`, `${blocked.length} مسودة بها أخطاء — افتحها لإصلاحها.`) });
    if (!ok.length) return;
    setBusy(true);
    toast({ tone: 'info', text: L(`Signing and submitting ${ok.length} document(s)…`, `جارٍ توقيع وإرسال ${ok.length} مستند…`) });
    setSel([]);
    await submit(ok);
    setBusy(false);
  };

  const exportCsv = () => {
    const header = ['internalID', 'type', 'uuid', 'issued', 'status', 'receiverType', 'receiverId', 'receiverName', 'total'];
    const lines = rows.map((d) => [d.internalID, d.documentType, d.uuid ?? '', d.issuedAt, d.status, d.counterparty.type, d.counterparty.id ?? '', `"${(d.counterparty.name ?? '').replace(/"/g, '""')}"`, docTotal(d).toFixed(2)].join(','));
    if (!saveTextFile('fatura-documents.csv', [header.join(','), ...lines].join('\n'))) toast({ tone: 'info', text: L('Downloads are disabled in this live preview; the deployed app saves the file.', 'التنزيل غير متاح في هذه المعاينة؛ التطبيق المنشور يحفظ الملف.') });
  };

  const allChecked = rows.length > 0 && rows.slice(0, limit).every((r) => sel.includes(r.id));

  return (
    <div className="animate-in">
      <PageHeader
        title={L('Invoices & notes', 'الفواتير والإشعارات')}
        description={L('Every sales document you issue to ETA — invoices, credit and debit notes, and export invoices.', 'كل مستندات المبيعات المُصدرة للمصلحة — فواتير وإشعارات وفواتير تصدير.')}
        actions={<>
          <Button icon={<Upload className="size-4" />} onClick={() => setImportOpen(true)}>{L('Import', 'استيراد')}</Button>
          <Button icon={<Download className="size-4" />} onClick={exportCsv}>{L('Export', 'تصدير')}</Button>
          <LinkButton to="/app/documents/new" variant="primary" icon={<Plus className="size-4" />}>{L('New document', 'مستند جديد')}</LinkButton>
        </>}
      />

      <Card pad={false}>
        <div className="px-4 pt-2">
          <Tabs value={tab} onChange={(v) => { setParams(v === 'all' ? {} : { status: v }); setSel([]); }} tabs={[
            { value: 'all', label: L('All', 'الكل'), count: count('all') },
            { value: 'Draft', label: L('Drafts', 'مسودات'), count: count('Draft') },
            { value: 'Submitted', label: L('In validation', 'قيد التحقق'), count: count('Submitted') },
            { value: 'Valid', label: L('Valid', 'صالحة'), count: count('Valid') },
            { value: 'Invalid', label: L('Invalid', 'غير صالحة'), count: count('Invalid') },
            { value: 'closed', label: L('Cancelled & rejected', 'ملغاة ومرفوضة'), count: count('closed') },
          ]} />
        </div>
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="relative w-full sm:w-auto sm:flex-1 sm:max-w-[320px]">
            <Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Number, customer, RIN or UUID', 'الرقم أو العميل أو الرقم الضريبي أو UUID')} className="ps-9" aria-label={L('Search', 'بحث')} />
          </div>
          <Select value={range} onChange={(e) => setRange(e.target.value)} className="w-auto" aria-label={L('Date range', 'الفترة')}>
            <option value="all">{L('All dates', 'كل التواريخ')}</option>
            <option value="7">{L('Last 7 days', 'آخر ٧ أيام')}</option>
            <option value="30">{L('Last 30 days', 'آخر ٣٠ يوماً')}</option>
            <option value="90">{L('Last 90 days', 'آخر ٩٠ يوماً')}</option>
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value)} className="w-auto" aria-label={L('Type', 'النوع')}>
            <option value="">{L('All types', 'كل الأنواع')}</option>
            {(['I', 'C', 'D', 'EI'] as const).map((t) => <option key={t} value={t}>{lb.docType(t)}</option>)}
          </Select>
          <Select value={pay} onChange={(e) => setPay(e.target.value)} className="w-auto" aria-label={L('Payment', 'الدفع')}>
            <option value="">{L('Any payment state', 'أي حالة دفع')}</option>
            <option value="overdue">{L('Overdue', 'متأخرة')}</option>
            <option value="due">{L('Unpaid', 'غير مدفوعة')}</option>
            <option value="partial">{L('Part-paid', 'مدفوعة جزئياً')}</option>
            <option value="paid">{L('Paid', 'مدفوعة')}</option>
          </Select>
        </div>

        {sel.length > 0 && (
          <div className="mx-4 mb-3 flex flex-wrap items-center gap-3 rounded-md bg-accent-soft border border-accent/20 px-3 py-2 animate-in">
            <span className="text-[13px] font-medium text-accent">{L(`${sel.length} selected`, `تم اختيار ${sel.length}`)}</span>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" onClick={() => setSel([])}>{L('Clear', 'مسح')}</Button>
            <Button size="sm" variant="primary" icon={<Send className="size-3.5" />} disabled={!selectedDrafts.length || signerOffline} loading={busy} onClick={bulkSubmit}
              title={signerOffline ? L('Signing agent is offline', 'وكيل التوقيع غير متصل') : undefined}>
              {L(`Sign & submit ${selectedDrafts.length} draft(s)`, `توقيع وإرسال ${selectedDrafts.length} مسودة`)}
            </Button>
          </div>
        )}
        {signerOffline && tab === 'Draft' && <div className="px-4 pb-3"><Callout tone="warn" title={L('Signing agent offline', 'وكيل التوقيع غير متصل')}>{L('Plug in the USB token and start Fatura Signer to submit.', 'وصّل التوكن وشغّل برنامج فاتورة للتوقيع.')}</Callout></div>}

        {rows.length === 0 ? (
          <EmptyState icon={<FileText className="size-5" />} title={q || type || pay || range !== 'all' ? L('No documents match these filters', 'لا توجد مستندات مطابقة') : L('No documents here yet', 'لا توجد مستندات بعد')}
            body={L('Create an invoice or clear the filters.', 'أنشئ فاتورة أو امسح عوامل التصفية.')}
            action={<LinkButton to="/app/documents/new" variant="primary" icon={<Plus className="size-4" />}>{L('New invoice', 'فاتورة جديدة')}</LinkButton>} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10"><input type="checkbox" className="accent-[rgb(var(--accent))] size-4" aria-label={L('Select all', 'تحديد الكل')} checked={allChecked}
                    onChange={(e) => setSel(e.target.checked ? rows.slice(0, limit).map((r) => r.id) : [])} /></Th>
                  <Th>{L('Document', 'المستند')}</Th><Th>{L('Customer', 'العميل')}</Th><Th>{L('Issued', 'الإصدار')}</Th>
                  <Th>{L('ETA status', 'حالة المصلحة')}</Th><Th>{L('Payment', 'الدفع')}</Th><Th align="end">{L('Total', 'الإجمالي')}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((d) => (
                  <tr key={d.id} className="hover:bg-sunken/50 cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).closest('input,a')) return; nav(`/app/documents/${d.id}`); }}>
                    <Td><input type="checkbox" className="accent-[rgb(var(--accent))] size-4" aria-label={d.internalID} checked={sel.includes(d.id)} onChange={(e) => setSel((s) => e.target.checked ? [...s, d.id] : s.filter((x) => x !== d.id))} /></Td>
                    <Td className="whitespace-nowrap">
                      <Link to={`/app/documents/${d.id}`} className="font-medium text-ink hover:text-accent">{d.internalID}</Link>
                      <div className="flex items-center gap-1.5 text-[12px] text-ink-subtle">{lb.docType(d.documentType)}{d.uuid && <> · <Mono className="text-[11.5px]">{d.uuid.slice(0, 8)}…</Mono></>}</div>
                    </Td>
                    <Td className="max-w-[260px]"><div className="truncate text-ink">{d.counterparty.name ?? L('Walk-in customer', 'عميل نقدي')}</div><div className="text-[12px] text-ink-subtle">{lb.party(d.counterparty.type)}{d.counterparty.id ? <> · <Mono className="text-[11.5px]">{d.counterparty.id}</Mono></> : null}</div></Td>
                    <Td className="whitespace-nowrap text-ink-muted">{date(d.issuedAt)}</Td>
                    <Td><StatusBadge status={d.status} /></Td>
                    <Td><div className="flex flex-col items-start gap-1"><DueBadge doc={d} />{d.plan.kind !== 'one-time' || d.recurringId ? <PlanBadge plan={d.recurringId ? { kind: 'recurring' } as never : d.plan} /> : null}</div></Td>
                    <Td align="end"><Money value={docTotal(d)} className="font-medium" /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex items-center justify-between px-4 py-3 text-[12.5px] text-ink-subtle">
              <span>{L(`Showing ${Math.min(limit, rows.length)} of ${rows.length}`, `عرض ${Math.min(limit, rows.length)} من ${rows.length}`)}</span>
              {limit < rows.length && <Button size="sm" onClick={() => setLimit((l) => l + 25)}>{L('Load more', 'تحميل المزيد')}</Button>}
            </div>
          </>
        )}
      </Card>

      <Modal open={importOpen} onClose={() => setImportOpen(false)} title={L('Import documents', 'استيراد المستندات')}
        footer={<><Button onClick={() => setImportOpen(false)}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" onClick={() => { setImportOpen(false); toast({ tone: 'info', text: L('Template downloaded. Upload it when it is filled in.', 'تم تنزيل النموذج. ارفعه بعد تعبئته.') }); }}>{L('Download template', 'تنزيل النموذج')}</Button></>}>
        <div className="space-y-4">
          <p className="text-ink-muted">{L('Bring invoices from Excel, your ERP or the ETA portal export. Rows are imported as drafts — nothing is sent to ETA until you review and submit.', 'استورد الفواتير من إكسل أو نظام ERP. تُستورد كمسودات ولا تُرسل للمصلحة إلا بعد المراجعة.')}</p>
          <label className="flex flex-col items-center justify-center gap-2 h-36 rounded-lg border-2 border-dashed border-line hover:border-accent/50 bg-sunken/40 cursor-pointer text-center px-4">
            <Upload className="size-5 text-ink-subtle" />
            <span className="font-medium text-ink">{L('Drop a .csv or .xlsx file', 'أسقط ملف csv أو xlsx')}</span>
            <span className="text-[12.5px] text-ink-subtle">{L('One row per line item; rows with the same internal number become one document.', 'صف لكل بند؛ الصفوف بنفس الرقم الداخلي تصبح مستنداً واحداً.')}</span>
            <input type="file" accept=".csv,.xlsx" className="sr-only" onChange={() => { setImportOpen(false); toast({ tone: 'ok', text: L('File received — mapping columns…', 'تم استلام الملف — جارٍ ربط الأعمدة…') }); }} />
          </label>
          <Callout tone="info">{L('Item codes must already be approved by ETA, otherwise the documents will come back Invalid.', 'يجب أن تكون أكواد الأصناف معتمدة من المصلحة وإلا ستعود المستندات غير صالحة.')}</Callout>
        </div>
      </Modal>
    </div>
  );
}
