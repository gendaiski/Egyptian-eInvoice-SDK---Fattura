import { CalendarClock, Layers, Repeat, Zap } from 'lucide-react';
import type { PaymentPlan } from '@/billing/schedules';
import type { DocumentTypeCode, PartyType } from '@/eta/types';
import { useI18n } from '@/i18n';
import { dueInfo, type Doc } from '@/store/model';
import { Badge } from '@/components/ui';

export function useLabels() {
  const { L } = useI18n();
  return {
    docType: (t: DocumentTypeCode) => ({
      I: L('Invoice', 'فاتورة'), C: L('Credit note', 'إشعار دائن'), D: L('Debit note', 'إشعار مدين'),
      EI: L('Export invoice', 'فاتورة تصدير'), EC: L('Export credit note', 'إشعار دائن تصدير'), ED: L('Export debit note', 'إشعار مدين تصدير'),
    }[t]),
    party: (t: PartyType) => ({ B: L('Business', 'شركة'), P: L('Individual', 'فرد'), F: L('Foreign', 'أجنبي') }[t]),
    partyId: (t: PartyType) => ({ B: L('Tax registration no. (RIN)', 'رقم التسجيل الضريبي'), P: L('National ID', 'الرقم القومي'), F: L('Foreign ID / passport', 'رقم الهوية الأجنبية') }[t]),
    terms: (t: string) => ({ receipt: L('Due on receipt', 'مستحقة فور الاستلام'), net15: L('Net 15', 'خلال ١٥ يوماً'), net30: L('Net 30', 'خلال ٣٠ يوماً'), net45: L('Net 45', 'خلال ٤٥ يوماً'), net60: L('Net 60', 'خلال ٦٠ يوماً') }[t] ?? t),
    freq: (f: string, n = 1) => n > 1
      ? L(`Every ${n} ${f === 'weekly' ? 'weeks' : f === 'monthly' ? 'months' : f === 'quarterly' ? 'quarters' : 'years'}`, `كل ${n} ${f === 'weekly' ? 'أسابيع' : f === 'monthly' ? 'أشهر' : f === 'quarterly' ? 'أرباع' : 'سنوات'}`)
      : ({ weekly: L('Weekly', 'أسبوعياً'), monthly: L('Monthly', 'شهرياً'), quarterly: L('Quarterly', 'ربع سنوي'), yearly: L('Yearly', 'سنوياً') }[f] ?? f),
    method: (m: string) => ({ bank: L('Bank transfer', 'تحويل بنكي'), cash: L('Cash', 'نقداً'), card: L('Card', 'بطاقة'), cheque: L('Cheque', 'شيك'), instapay: 'InstaPay' }[m] ?? m),
  };
}

export function PlanBadge({ plan }: { plan: PaymentPlan }) {
  const { L } = useI18n();
  if (plan.kind === 'installments') return <Badge tone="info" icon={<Layers className="size-3" />}>{L(`${plan.count} installments`, `${plan.count} أقساط`)}</Badge>;
  if (plan.kind === 'recurring') return <Badge tone="accent" icon={<Repeat className="size-3" />}>{L('Recurring', 'متكررة')}</Badge>;
  return <Badge icon={<Zap className="size-3" />}>{L('One-time', 'دفعة واحدة')}</Badge>;
}

export function DueBadge({ doc }: { doc: Doc }) {
  const { L, date } = useI18n();
  const d = dueInfo(doc);
  if (d.state === 'na') return <span className="text-ink-subtle">—</span>;
  if (d.state === 'paid') return <Badge tone="ok">{L('Paid', 'مدفوعة')}</Badge>;
  if (d.state === 'overdue') return <Badge tone="bad" icon={<CalendarClock className="size-3" />}>{L('Overdue', 'متأخرة')} · {date(d.dueDate)}</Badge>;
  if (d.state === 'partial') return <Badge tone="warn">{L('Part-paid', 'مدفوعة جزئياً')}</Badge>;
  return <span className="text-[12.5px] text-ink-muted">{L('Due', 'تستحق')} {date(d.dueDate)}</span>;
}
