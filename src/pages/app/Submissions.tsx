import { ChevronDown, Send } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Badge, Card, EmptyState, Mono, PageHeader, StatusBadge, Table, Td, Th, cx, type Tone } from '@/components/ui';

export function Submissions() {
  const { db } = useStore();
  const { L, date, num } = useI18n();
  const [open, setOpen] = useState<string | null>(null);
  const tone: Record<string, Tone> = { Valid: 'ok', Invalid: 'bad', PartiallyValid: 'warn', InProgress: 'info' };
  const label: Record<string, string> = { Valid: L('Valid', 'صالحة'), Invalid: L('Invalid', 'غير صالحة'), PartiallyValid: L('Partially valid', 'صالحة جزئياً'), InProgress: L('In progress', 'قيد المعالجة') };
  const avg = db.submissions.length ? db.submissions.reduce((s, x) => s + x.ms, 0) / db.submissions.length : 0;
  return (
    <div className="animate-in">
      <PageHeader title={L('Submissions log', 'سجل الإرسال')} description={L('Every call to POST /api/v1/documentsubmissions, with what ETA accepted and how validation ended. Keep it for audits.', 'كل عملية إرسال للمصلحة ونتيجتها. احتفظ به للمراجعة.')} />
      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Submissions', 'عمليات الإرسال')}</div><div className="text-[24px] font-semibold tabular mt-1">{db.submissions.length}</div></div>
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Average round-trip', 'متوسط زمن الاستجابة')}</div><div className="text-[24px] font-semibold tabular mt-1">{num(avg / 1000, 2)}s</div></div>
        <div className="card p-4"><div className="text-[12.5px] text-ink-muted">{L('Rejected at intake', 'مرفوضة عند الاستلام')}</div><div className="text-[24px] font-semibold tabular mt-1">{db.submissions.reduce((s, x) => s + x.rejected, 0)}</div></div>
      </div>
      <Card pad={false}>
        {db.submissions.length === 0 ? <EmptyState icon={<Send className="size-5" />} title={L('No submissions yet', 'لا توجد عمليات إرسال')} /> : (
          <Table>
            <thead><tr><Th>{L('Submission', 'الإرسال')}</Th><Th>{L('When', 'الوقت')}</Th><Th>{L('By', 'بواسطة')}</Th><Th align="end">{L('Accepted', 'مقبولة')}</Th><Th align="end">{L('Rejected', 'مرفوضة')}</Th><Th>{L('Outcome', 'النتيجة')}</Th><Th align="end">{L('Time', 'المدة')}</Th><Th /></tr></thead>
            <tbody>{db.submissions.map((s) => (
              <Fragment key={s.id}>
                <tr className="hover:bg-sunken/50 cursor-pointer" onClick={() => setOpen(open === s.id ? null : s.id)} aria-expanded={open === s.id}>
                  <Td><Mono>{s.id}</Mono></Td>
                  <Td className="text-ink-muted whitespace-nowrap">{date(s.at, 'datetime')}</Td>
                  <Td className="text-ink-muted">{s.by}</Td>
                  <Td align="end">{s.accepted}</Td>
                  <Td align="end">{s.rejected}</Td>
                  <Td><Badge tone={tone[s.status]}>{label[s.status]}</Badge></Td>
                  <Td align="end" className="text-ink-muted">{num(s.ms)} ms</Td>
                  <Td><ChevronDown className={cx('size-4 text-ink-subtle transition-transform', open === s.id && 'rotate-180')} /></Td>
                </tr>
                {open === s.id && (
                  <tr><td colSpan={8} className="bg-sunken/40 px-4 py-3 border-b border-line">
                    <ul className="space-y-1.5">{s.docIds.map((id) => { const d = db.docs.find((x) => x.id === id); return d ? <li key={id} className="flex items-center gap-3 text-[13px]"><Link to={`/app/documents/${id}`} className="link">{d.internalID}</Link><span className="text-ink-muted truncate">{d.counterparty.name}</span><StatusBadge status={d.status} />{d.uuid && <Mono className="text-ink-subtle">{d.uuid}</Mono>}</li> : null; })}</ul>
                  </td></tr>
                )}
              </Fragment>
            ))}</tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
