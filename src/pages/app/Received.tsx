import { FileInput, RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DOCUMENT_TYPES } from '@/eta/mockClient';
import { useI18n } from '@/i18n';
import { docTotal, docVat, windowHoursLeft } from '@/store/model';
import { useActions, useStore } from '@/store/store';
import { api, reportApiError } from '@/lib/api';
import { Badge, Button, Callout, Card, EmptyState, Input, Money, Mono, PageHeader, StatusBadge, Table, Tabs, Td, Th, useToast } from '@/components/ui';
import { useLabels } from './shared';

export function Received() {
  const { db, mode, reload } = useStore();
  const actions = useActions();
  const { L, date, money } = useI18n();
  const lb = useLabels();
  const nav = useNavigate();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | 'action' | 'Valid' | 'closed'>('all');
  const [q, setQ] = useState('');
  const [syncing, setSyncing] = useState(false);
  const rejectWindow = DOCUMENT_TYPES[0].workflowParameters.rejectionWindowHours;
  const all = db.docs.filter((d) => d.direction === 'received');
  const rows = useMemo(() => all.filter((d) =>
    (tab === 'all' || (tab === 'action' ? !!d.pending : tab === 'Valid' ? d.status === 'Valid' : d.status === 'Cancelled' || d.status === 'Rejected'))
    && (!q || `${d.internalID} ${d.counterparty.name} ${d.counterparty.id} ${d.uuid}`.toLowerCase().includes(q.toLowerCase()))), [all, tab, q]);
  const inputVat = all.filter((d) => d.status === 'Valid').reduce((s, d) => s + docVat(d), 0);

  return (
    <div className="animate-in">
      <PageHeader title={L('Received documents', 'المستندات الواردة')}
        description={L('Purchase invoices your suppliers registered with ETA against your tax number. Pulled with Search Documents (direction = Received).', 'فواتير المشتريات المسجلة على رقمك الضريبي من الموردين.')}
        actions={<Button icon={<RefreshCw className={syncing ? 'size-4 animate-spin' : 'size-4'} />} onClick={async () => { setSyncing(true); if (mode === 'api') { try { await api('POST', '/actions/received/sync'); await reload(); } catch (e) { reportApiError(e); setSyncing(false); return; } } else await new Promise((r) => setTimeout(r, 900)); setSyncing(false); toast({ tone: 'ok', text: L('Up to date with ETA.', 'محدثة مع المصلحة.') }); }}>{L('Sync now', 'مزامنة الآن')}</Button>} />

      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Valid purchase documents', 'مستندات شراء صالحة')}</div><div className="text-[24px] font-semibold tabular mt-1">{all.filter((d) => d.status === 'Valid').length}</div></div>
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Recoverable input VAT', 'ضريبة المدخلات القابلة للخصم')}</div><div className="text-[24px] font-semibold tabular mt-1">{money(inputVat, 'EGP', { compact: true })}</div></div>
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Waiting for your decision', 'بانتظار قرارك')}</div><div className="text-[24px] font-semibold tabular mt-1">{all.filter((d) => d.pending).length}</div></div>
      </div>

      {all.some((d) => d.pending) && (
        <div className="mb-5 space-y-2">
          {all.filter((d) => d.pending).map((d) => (
            <Callout key={d.id} tone="warn" title={L(`${d.counterparty.name} wants to cancel ${d.internalID}`, `${d.counterparty.name} يطلب إلغاء ${d.internalID}`)}
              action={<div className="flex gap-2">
                <Button size="sm" onClick={async () => { await actions.declineCancellation(d.id); toast({ tone: 'ok', text: L('Cancellation declined — the document stays valid.', 'تم رفض الإلغاء — يبقى المستند صالحاً.') }); }}>{L('Decline', 'رفض')}</Button>
                <Button size="sm" variant="primary" onClick={async () => { await actions.acceptCancellation(d.id); toast({ tone: 'ok', text: L('Cancellation accepted.', 'تم قبول الإلغاء.') }); }}>{L('Accept', 'قبول')}</Button>
              </div>}>
              {money(docTotal(d))} · {L('issued', 'صدر')} {date(d.issuedAt)}. {L('Decline if you already booked it and the goods were delivered.', 'ارفض إن كنت سجلته واستلمت البضاعة.')}
            </Callout>
          ))}
        </div>
      )}

      <Card pad={false}>
        <div className="px-4 pt-2"><Tabs value={tab} onChange={setTab} tabs={[
          { value: 'all', label: L('All', 'الكل'), count: all.length },
          { value: 'action', label: L('Needs action', 'تحتاج إجراء'), count: all.filter((d) => d.pending).length },
          { value: 'Valid', label: L('Valid', 'صالحة'), count: all.filter((d) => d.status === 'Valid').length },
          { value: 'closed', label: L('Cancelled & rejected', 'ملغاة ومرفوضة'), count: all.filter((d) => d.status === 'Cancelled' || d.status === 'Rejected').length },
        ]} /></div>
        <div className="p-4"><div className="relative max-w-[340px]"><Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Supplier, number or UUID', 'المورد أو الرقم أو UUID')} aria-label={L('Search', 'بحث')} /></div></div>
        {rows.length === 0 ? <EmptyState icon={<FileInput className="size-5" />} title={L('Nothing here', 'لا يوجد شيء هنا')} body={L('Documents appear as soon as suppliers submit them to ETA.', 'تظهر المستندات فور إرسالها من الموردين.')} /> : (
          <Table>
            <thead><tr><Th>{L('Supplier', 'المورد')}</Th><Th>{L('Document', 'المستند')}</Th><Th>{L('Issued', 'الإصدار')}</Th><Th>{L('Status', 'الحالة')}</Th><Th>{L('Reject window', 'مهلة الرفض')}</Th><Th align="end">{L('VAT', 'الضريبة')}</Th><Th align="end">{L('Total', 'الإجمالي')}</Th></tr></thead>
            <tbody>
              {rows.map((d) => {
                const h = windowHoursLeft(d, rejectWindow);
                return (
                  <tr key={d.id} className="hover:bg-sunken/50 cursor-pointer" onClick={() => nav(`/app/documents/${d.id}`)}>
                    <Td className="max-w-[240px]"><div className="truncate font-medium text-ink">{d.counterparty.name}</div><Mono className="text-[11.5px] text-ink-subtle">{d.counterparty.id}</Mono></Td>
                    <Td><Link to={`/app/documents/${d.id}`} className="text-ink hover:text-accent">{d.internalID}</Link><div className="text-[12px] text-ink-subtle">{lb.docType(d.documentType)}</div></Td>
                    <Td className="text-ink-muted whitespace-nowrap">{date(d.issuedAt)}</Td>
                    <Td>{d.pending ? <Badge tone="warn">{L('Cancel requested', 'طلب إلغاء')}</Badge> : <StatusBadge status={d.status} />}</Td>
                    <Td className="text-[12.5px] text-ink-muted whitespace-nowrap">{d.status === 'Valid' && h > 0 ? L(`${Math.ceil(h / 24)} day(s) left`, `متبقي ${Math.ceil(h / 24)} يوم`) : '—'}</Td>
                    <Td align="end"><Money value={docVat(d)} muted /></Td>
                    <Td align="end"><Money value={docTotal(d)} className="font-medium" /></Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
