import { AlertTriangle, ArrowRight, Ban, CalendarClock, CheckCircle2, FileInput, PenLine, Plus, Repeat, ShieldAlert, Wallet, XCircle } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { recurringRuns } from '@/billing/schedules';
import { useI18n } from '@/i18n';
import { docTotal, docVat, dueInfo } from '@/store/model';
import { useStore } from '@/store/store';
import { BarChart, StackedMeter } from '@/components/charts';
import { Card, LinkButton, Money, PageHeader, Stat, StatusBadge, Table, Td, Th, cx } from '@/components/ui';
import { useLabels } from './shared';

const monthKey = (iso: string) => iso.slice(0, 7);

export function Dashboard() {
  const { db } = useStore();
  const { L, money, date, lang } = useI18n();
  const lb = useLabels();
  const sent = db.docs.filter((d) => d.direction === 'sent');
  const today = new Date().toISOString().slice(0, 10);

  const stats = useMemo(() => {
    const now = new Date();
    const thisM = monthKey(now.toISOString());
    const prev = new Date(now); prev.setUTCMonth(prev.getUTCMonth() - 1, 15);
    const lastM = monthKey(prev.toISOString());
    const issued = (m: string) => sent.filter((d) => d.status === 'Valid' && (d.documentType === 'I' || d.documentType === 'EI') && monthKey(d.issuedAt) === m);
    const cur = issued(thisM), last = issued(lastM);
    const sum = (a: typeof cur) => a.reduce((s, d) => s + docTotal(d), 0);
    const credit = sent.filter((d) => d.status === 'Valid' && d.documentType === 'C' && monthKey(d.issuedAt) === thisM);
    const vat = cur.reduce((s, d) => s + docVat(d), 0) - credit.reduce((s, d) => s + docVat(d), 0);
    const due = sent.map((d) => ({ d, i: dueInfo(d, today) }));
    const outstanding = due.reduce((s, x) => s + x.i.outstanding, 0);
    const overdue = due.filter((x) => x.i.state === 'overdue').reduce((s, x) => s + x.i.outstanding, 0);
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const recent = sent.filter((d) => d.submittedAt && d.submittedAt >= since);
    const valid = recent.filter((d) => d.status !== 'Invalid' && d.status !== 'Submitted').length;
    const decided = recent.filter((d) => d.status !== 'Submitted').length;
    return { cur, last, sumCur: sum(cur), sumLast: sum(last), vat, outstanding, overdue, rate: decided ? valid / decided : 1, recent };
  }, [sent, today]);

  const months = useMemo(() => {
    const out: { label: string; value: number; sub: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - i);
      const key = monthKey(d.toISOString());
      const docs = sent.filter((x) => x.status === 'Valid' && (x.documentType === 'I' || x.documentType === 'EI') && monthKey(x.issuedAt) === key);
      out.push({ label: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'short' }).format(d), value: docs.reduce((s, x) => s + docTotal(x), 0), sub: L(`${docs.length} invoices`, `${docs.length} فاتورة`) });
    }
    return out;
  }, [sent, lang, L]);

  const counts = (s: string) => stats.recent.filter((d) => d.status === s).length;
  const invalid = sent.filter((d) => d.status === 'Invalid');
  const drafts = sent.filter((d) => d.status === 'Draft');
  const cancelReqs = db.docs.filter((d) => d.direction === 'received' && d.pending === 'cancellation_requested');
  const certDays = Math.round((new Date(db.signing.certificate.expires).getTime() - Date.now()) / 86_400_000);
  const rejectedCodes = db.items.filter((i) => i.codeStatus === 'Rejected');

  const tasks: { tone: 'bad' | 'warn' | 'info'; icon: ReactNode; title: string; body: string; to: string; cta: string }[] = [];
  if (invalid.length) tasks.push({ tone: 'bad', icon: <XCircle />, title: L(`${invalid.length} invalid document(s)`, `${invalid.length} مستند غير صالح`), body: L('ETA rejected these during validation. Fix and resubmit with a new number.', 'رفضتها المصلحة أثناء التحقق. صحّحها وأعد إرسالها.'), to: '/app/documents?status=Invalid', cta: L('Review', 'مراجعة') });
  if (cancelReqs.length) tasks.push({ tone: 'warn', icon: <FileInput />, title: L(`${cancelReqs.length} cancellation request(s)`, `${cancelReqs.length} طلب إلغاء`), body: L('A supplier wants to cancel a document you received. Accept or decline within the window.', 'مورد يطلب إلغاء مستند مستلم. اقبل أو ارفض خلال المهلة.'), to: '/app/received', cta: L('Decide', 'اتخاذ قرار') });
  if (drafts.length) tasks.push({ tone: 'info', icon: <PenLine />, title: L(`${drafts.length} draft(s) ready to submit`, `${drafts.length} مسودة جاهزة للإرسال`), body: L('Includes recurring invoices waiting for approval.', 'تشمل فواتير متكررة بانتظار الاعتماد.'), to: '/app/documents?status=Draft', cta: L('Open drafts', 'فتح المسودات') });
  if (certDays < 60) tasks.push({ tone: 'warn', icon: <ShieldAlert />, title: L(`Signing certificate expires in ${certDays} days`, `شهادة التوقيع تنتهي خلال ${certDays} يوماً`), body: L('Renew with your certificate authority before it lapses — submissions stop without it.', 'جدّد الشهادة قبل انتهائها — يتوقف الإرسال بدونها.'), to: '/app/settings/signing', cta: L('Details', 'التفاصيل') });
  if (rejectedCodes.length) tasks.push({ tone: 'bad', icon: <AlertTriangle />, title: L(`${rejectedCodes.length} item code(s) rejected`, `${rejectedCodes.length} كود صنف مرفوض`), body: L('Invoices using these codes will be Invalid.', 'الفواتير التي تستخدم هذه الأكواد ستكون غير صالحة.'), to: '/app/items', cta: L('Fix codes', 'إصلاح الأكواد') });

  const upcoming = useMemo(() => {
    const horizon = new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10);
    const rec = db.recurring.filter((r) => r.status === 'active').flatMap((r) => recurringRuns(r.plan, 3, today).filter((d) => d <= horizon).map((d) => ({ date: d, kind: 'recurring' as const, label: r.name, amount: docTotal({ lines: r.lines, extraDiscount: 0 } as never), to: `/app/recurring/${r.id}` })));
    const inst = sent.flatMap((d) => (d.installments ?? []).filter((i) => i.paid < i.amount && i.dueDate <= horizon).map((i) => ({ date: i.dueDate, kind: 'installment' as const, label: `${d.counterparty.name} · ${i.label === 'down' ? L('down payment', 'دفعة مقدمة') : L(`installment ${i.n}`, `القسط ${i.n}`)}`, amount: i.amount - i.paid, to: `/app/documents/${d.id}` })));
    return [...rec, ...inst].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 7);
  }, [db.recurring, sent, today, L]);

  const delta = stats.sumLast ? (stats.sumCur - stats.sumLast) / stats.sumLast : 0;
  const hour = new Date().getHours();
  const first = db.session.user.name.split(' ')[0];

  return (
    <div className="animate-in">
      <PageHeader
        title={hour < 12 ? L(`Good morning, ${first}`, `صباح الخير يا ${first}`) : L(`Good afternoon, ${first}`, `مساء الخير يا ${first}`)}
        description={L(`${db.company.name} · ${date(new Date().toISOString(), 'long')}`, `${db.company.nameAr} · ${date(new Date().toISOString(), 'long')}`)}
        actions={<>
          <LinkButton to="/app/documents?status=Draft" icon={<PenLine className="size-4" />}>{L('Drafts', 'المسودات')} ({drafts.length})</LinkButton>
          <LinkButton to="/app/documents/new" variant="primary" icon={<Plus className="size-4" />}>{L('New invoice', 'فاتورة جديدة')}</LinkButton>
        </>}
      />

      {tasks.length > 0 && (
        <section aria-label={L('Needs attention', 'تحتاج انتباهك')} className="mb-6">
          <h2 className="text-[13px] font-semibold text-ink-muted mb-2.5">{L('Needs your attention', 'تحتاج انتباهك')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tasks.slice(0, 3).map((t) => (
              <Link key={t.title} to={t.to} className="group card p-4 flex gap-3 hover:border-ink-subtle/40 transition-colors">
                <span className={cx('size-9 rounded-md grid place-items-center shrink-0 [&>svg]:size-[18px]', t.tone === 'bad' ? 'bg-bad-soft text-bad' : t.tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-info-soft text-info')}>{t.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{t.title}</span>
                  <span className="block text-[13px] text-ink-muted mt-0.5">{t.body}</span>
                  <span className="inline-flex items-center gap-1 mt-2 text-[13px] font-medium text-accent">{t.cta}<ArrowRight className="size-3.5 rtl:rotate-180 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" /></span>
                </span>
              </Link>
            ))}
          </div>
          {tasks.length > 3 && <p className="mt-2 text-[12.5px] text-ink-subtle">{L(`+${tasks.length - 3} more`, `+${tasks.length - 3} أخرى`)}: {tasks.slice(3).map((t) => <Link key={t.title} to={t.to} className="link me-3">{t.title}</Link>)}</p>}
        </section>
      )}

      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 mb-6">
        <Stat label={L('Issued this month', 'المُصدَر هذا الشهر')} value={money(stats.sumCur, 'EGP', { compact: true })}
          delta={`${delta >= 0 ? '+' : ''}${(delta * 100).toFixed(0)}%`} tone={delta >= 0 ? 'ok' : 'bad'} hint={L(`vs last month · ${stats.cur.length} invoices`, `عن الشهر الماضي · ${stats.cur.length} فاتورة`)} />
        <Stat label={L('Output VAT (T1) this month', 'ضريبة المخرجات هذا الشهر')} value={money(stats.vat, 'EGP', { compact: true })} hint={L('net of credit notes', 'بعد خصم الإشعارات الدائنة')} />
        <Stat label={L('Outstanding receivables', 'المستحقات القائمة')} value={money(stats.outstanding, 'EGP', { compact: true })}
          delta={money(stats.overdue, 'EGP', { compact: true })} tone={stats.overdue > 0 ? 'bad' : 'neutral'} hint={L('overdue', 'متأخرة')} icon={<Wallet className="size-4" />} />
        <Stat label={L('ETA acceptance · 30 days', 'نسبة القبول · ٣٠ يوماً')} value={`${(stats.rate * 100).toFixed(1)}%`}
          hint={L(`${stats.recent.length} submitted`, `${stats.recent.length} مُرسلة`)} icon={<CheckCircle2 className="size-4 text-ok" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-6">
        <Card className="lg:col-span-2" title={L('Valid invoices issued', 'الفواتير الصالحة المُصدرة')} subtitle={L('Total value incl. tax, last 6 months', 'القيمة الإجمالية شاملة الضريبة، آخر ٦ أشهر')}>
          <BarChart data={months} format={(n) => money(n, 'EGP', { compact: true })} ariaLabel={L('Valid invoices issued per month', 'الفواتير الصالحة شهرياً')} highlightLast />
        </Card>
        <Card title={L('Submission outcomes', 'نتائج الإرسال')} subtitle={L('Last 30 days', 'آخر ٣٠ يوماً')}>
          <div className="text-[34px] font-semibold tabular leading-none mt-1">{stats.recent.length}</div>
          <div className="text-[12.5px] text-ink-subtle mb-5">{L('documents submitted to ETA', 'مستند أُرسل للمصلحة')}</div>
          <StackedMeter parts={[
            { label: L('Valid', 'صالحة'), value: counts('Valid'), className: 'bg-ok', icon: <CheckCircle2 className="size-3" /> },
            { label: L('Invalid', 'غير صالحة'), value: counts('Invalid'), className: 'bg-bad', icon: <XCircle className="size-3" /> },
            { label: L('Cancelled', 'ملغاة'), value: counts('Cancelled'), className: 'bg-ink-subtle', icon: <Ban className="size-3" /> },
            { label: L('Rejected', 'مرفوضة'), value: counts('Rejected'), className: 'bg-warn', icon: <AlertTriangle className="size-3" /> },
          ]} />
          <Link to="/app/submissions" className="mt-5 inline-flex items-center gap-1 text-[13px] font-medium link">{L('Submissions log', 'سجل الإرسال')}<ArrowRight className="size-3.5 rtl:rotate-180" /></Link>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2" pad={false} title={L('Recent documents', 'أحدث المستندات')} action={<Link to="/app/documents" className="text-[13px] font-medium link">{L('View all', 'عرض الكل')}</Link>}>
          <Table>
            <thead><tr><Th>{L('Number', 'الرقم')}</Th><Th>{L('Customer', 'العميل')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('Total', 'الإجمالي')}</Th></tr></thead>
            <tbody>
              {sent.slice(0, 7).map((d) => (
                <tr key={d.id} className="hover:bg-sunken/50">
                  <Td className="whitespace-nowrap"><Link to={`/app/documents/${d.id}`} className="font-medium text-ink hover:text-accent">{d.internalID}</Link><div className="text-[12px] text-ink-subtle">{lb.docType(d.documentType)} · {date(d.issuedAt)}</div></Td>
                  <Td className="max-w-[220px]"><div className="truncate">{d.counterparty.name}</div></Td>
                  <Td><StatusBadge status={d.status} /></Td>
                  <Td align="end"><Money value={docTotal(d)} /></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
        <Card title={L('Coming up', 'القادم')} subtitle={L('Recurring runs and installments, next 3 weeks', 'الفواتير المتكررة والأقساط خلال ٣ أسابيع')}>
          {upcoming.length === 0 ? <p className="text-ink-muted">{L('Nothing scheduled.', 'لا يوجد شيء مجدول.')}</p> : (
            <ul className="divide-y divide-line -my-2">
              {upcoming.map((u, i) => (
                <li key={i}>
                  <Link to={u.to} className="flex items-center gap-3 py-2.5 group">
                    <span className={cx('size-8 rounded-md grid place-items-center shrink-0', u.kind === 'recurring' ? 'bg-accent-soft text-accent' : 'bg-info-soft text-info')}>
                      {u.kind === 'recurring' ? <Repeat className="size-4" /> : <CalendarClock className="size-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] text-ink group-hover:text-accent">{u.label}</span>
                      <span className={cx('block text-[12px]', u.date < today ? 'text-bad' : 'text-ink-subtle')}>{date(u.date)} · {u.date < today ? L('overdue', 'متأخر') : u.kind === 'recurring' ? L('invoice run', 'إصدار فاتورة') : L('collection', 'تحصيل')}</span>
                    </span>
                    <Money value={u.amount} className="text-[13px]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
