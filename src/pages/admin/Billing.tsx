import { BellRing, CheckCircle2, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Badge, Button, Card, EmptyState, Money, PageHeader, Stat, Table, Tabs, Td, Th, useToast, type Tone } from '@/components/ui';

export function Billing() {
  const { db, set } = useStore();
  const { L, date, money } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | 'open' | 'overdue' | 'installments'>('all');
  const inv = db.admin.invoices;
  const rows = inv.filter((i) => tab === 'all' || (tab === 'installments' ? i.model === 'installments' : i.status === tab));
  const tenant = (id: string) => db.admin.tenants.find((t) => t.id === id)!;
  const tone: Record<string, Tone> = { paid: 'ok', open: 'warn', overdue: 'bad', void: 'neutral' };
  const sum = (f: (i: typeof inv[number]) => boolean) => inv.filter(f).reduce((s, i) => s + i.amount + i.vat, 0);
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  return (
    <div className="animate-in">
      <PageHeader title={L('Billing & collections', 'الفوترة والتحصيل')} description={L('Invoices Fatura issues to tenants — each one a valid ETA invoice — across monthly, yearly, installment and one-time sales.', 'الفواتير التي تصدرها فاتورة للشركات — كل منها فاتورة إلكترونية صالحة.')} />
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 mb-5">
        <Stat label={L('Collected · 30 days', 'المحصل · ٣٠ يوماً')} value={money(sum((i) => i.status === 'paid' && i.issuedAt >= since), 'EGP', { compact: true })} />
        <Stat label={L('Open', 'مفتوحة')} value={money(sum((i) => i.status === 'open'), 'EGP', { compact: true })} />
        <Stat label={L('Overdue', 'متأخرة')} value={money(sum((i) => i.status === 'overdue'), 'EGP', { compact: true })} tone="bad" delta={L(`${inv.filter((i) => i.status === 'overdue').length} invoices`, `${inv.filter((i) => i.status === 'overdue').length} فاتورة`)} />
        <Stat label={L('Installment plans running', 'خطط تقسيط جارية')} value={db.admin.tenants.filter((t) => t.model === 'installments').length} />
      </div>
      <Card pad={false}>
        <div className="px-4 pt-2"><Tabs value={tab} onChange={setTab} tabs={[
          { value: 'all', label: L('All', 'الكل'), count: inv.length },
          { value: 'open', label: L('Open', 'مفتوحة'), count: inv.filter((i) => i.status === 'open').length },
          { value: 'overdue', label: L('Overdue', 'متأخرة'), count: inv.filter((i) => i.status === 'overdue').length },
          { value: 'installments', label: L('Installments', 'أقساط'), count: inv.filter((i) => i.model === 'installments').length },
        ]} /></div>
        {rows.length === 0 ? <EmptyState icon={<CreditCard className="size-5" />} title={L('Nothing here', 'لا شيء هنا')} /> : (
          <Table>
            <thead><tr><Th>{L('Invoice', 'الفاتورة')}</Th><Th>{L('Tenant', 'الشركة')}</Th><Th>{L('Model', 'النموذج')}</Th><Th>{L('Issued · due', 'الإصدار · الاستحقاق')}</Th><Th>ETA</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('Total', 'الإجمالي')}</Th><Th /></tr></thead>
            <tbody>{rows.slice(0, 60).map((i) => (
              <tr key={i.id} className="hover:bg-sunken/50">
                <Td className="font-medium">{i.number}</Td>
                <Td><Link to={`/admin/tenants/${i.tenantId}`} className="text-ink hover:text-accent">{tenant(i.tenantId).name}</Link></Td>
                <Td className="text-ink-muted">{i.model === 'installments' ? L(`Installment ${i.installment}`, `قسط ${i.installment}`) : i.model === 'one-time' ? L('One-time licence', 'ترخيص دائم') : L('Subscription', 'اشتراك')}</Td>
                <Td className="text-ink-muted whitespace-nowrap">{date(i.issuedAt)} · {date(i.dueAt)}</Td>
                <Td><Badge tone="ok">{i.etaStatus}</Badge></Td>
                <Td><Badge tone={tone[i.status]}>{i.status}</Badge></Td>
                <Td align="end"><Money value={i.amount + i.vat} /></Td>
                <Td align="end">{(i.status === 'overdue' || i.status === 'open') && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" icon={<BellRing className="size-3.5" />} onClick={() => toast({ tone: 'ok', text: L(`Reminder sent to ${tenant(i.tenantId).owner}.`, `تم إرسال تذكير إلى ${tenant(i.tenantId).owner}.`) })}>{L('Remind', 'تذكير')}</Button>
                    <Button size="sm" icon={<CheckCircle2 className="size-3.5" />} onClick={() => { set((x) => { x.admin.invoices.find((y) => y.id === i.id)!.status = 'paid'; const t = x.admin.tenants.find((y) => y.id === i.tenantId)!; if (t.status === 'past_due') t.status = 'active'; }); toast({ tone: 'ok', text: L('Marked as paid.', 'تم التعليم كمدفوعة.') }); }}>{L('Mark paid', 'مدفوعة')}</Button>
                  </div>
                )}</Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
      <Card className="mt-5" title={L('Dunning policy', 'سياسة التحصيل')}>
        <ol className="grid sm:grid-cols-4 gap-3 text-[13px]">
          {[[L('Due date', 'الاستحقاق'), L('Email + WhatsApp reminder', 'تذكير بالبريد وواتساب')], [L('+3 days', '+٣ أيام'), L('Second reminder, in-app banner', 'تذكير ثانٍ وتنبيه داخلي')], [L('+10 days', '+١٠ أيام'), L('Status → past due; account manager call', 'الحالة ← متأخر؛ اتصال')], [L('+30 days', '+٣٠ يوماً'), L('Submission paused; read & export stay open', 'إيقاف الإرسال؛ القراءة والتصدير متاحة')]].map(([k, v], n) => (
            <li key={k} className="rounded-md border border-line p-3"><div className="text-[12px] text-ink-subtle tabular">0{n + 1} · {k}</div><div className="mt-1 text-ink">{v}</div></li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
