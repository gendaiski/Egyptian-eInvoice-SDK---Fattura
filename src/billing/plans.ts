import type { Plan, Tenant } from '@/store/model';

/** How a Fatura subscription is paid. Mirrors the tenant's billing model + cycle. */
export type Billing = 'monthly' | 'yearly' | 'installments' | 'one-time';

/** [amount, unit label EN, unit label AR] for a plan under a billing model. */
export function priceFor(p: Plan, b: Billing): [number, string, string] {
  if (b === 'monthly') return [p.monthly, '/ month', '/ شهر'];
  if (b === 'yearly') return [p.yearly, '/ year', '/ سنة'];
  if (b === 'installments') return [p.installments.amount, `× ${p.installments.count}`, `× ${p.installments.count}`];
  return [p.oneTime, 'once', 'مرة واحدة'];
}

export const billingOf = (t: Pick<Tenant, 'model' | 'cycle'>): Billing => (t.model === 'recurring' ? t.cycle ?? 'monthly' : t.model);
