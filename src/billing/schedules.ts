import { r2 } from '@/eta/calc';

/**
 * How the customer pays for a document. ETA only ever sees the tax document;
 * the plan drives Fatura's receivables, reminders and (for recurring) generation.
 *  - one-time:     one ETA invoice, one due date.
 *  - recurring:    a template; each run issues a NEW ETA invoice dated on the run day
 *                  (ETA rejects future-dated documents, so nothing is pre-issued).
 *  - installments: one ETA invoice for the full amount (VAT is due at issuance),
 *                  collected over a schedule tracked in Fatura.
 */
export type Frequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type PaymentTerms = 'receipt' | 'net15' | 'net30' | 'net45' | 'net60';

export type RecurringEnd = { type: 'never' } | { type: 'after'; count: number } | { type: 'on'; date: string };
export type RecurringDelivery = 'draft' | 'submit' | 'submit_email';

export type PaymentPlan =
  | { kind: 'one-time'; terms: PaymentTerms }
  | { kind: 'recurring'; frequency: Frequency; interval: number; startDate: string; end: RecurringEnd; delivery: RecurringDelivery; terms: PaymentTerms }
  | { kind: 'installments'; count: number; frequency: Frequency; firstDueDate: string; downPaymentPct: number };

export const TERMS_DAYS: Record<PaymentTerms, number> = { receipt: 0, net15: 15, net30: 30, net45: 45, net60: 60 };

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Adds `n` periods to a date. Month arithmetic clamps to the last day (31 Jan + 1 month → 28/29 Feb). */
export function addPeriods(dateISO: string, frequency: Frequency, n: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  if (frequency === 'weekly') { d.setUTCDate(d.getUTCDate() + 7 * n); return iso(d); }
  const months = frequency === 'monthly' ? n : frequency === 'quarterly' ? 3 * n : 12 * n;
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return iso(d);
}

export function dueDate(issueISO: string, terms: PaymentTerms): string {
  const d = new Date(`${issueISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + TERMS_DAYS[terms]);
  return iso(d);
}

/** Upcoming run dates for a recurring plan, starting at or after `fromISO`. */
export function recurringRuns(plan: Extract<PaymentPlan, { kind: 'recurring' }>, limit = 6, fromISO?: string): string[] {
  const out: string[] = [];
  const max = plan.end.type === 'after' ? plan.end.count : Infinity;
  for (let i = 0; i < max && out.length < limit; i++) {
    const run = addPeriods(plan.startDate, plan.frequency, i * Math.max(1, plan.interval));
    if (plan.end.type === 'on' && run > plan.end.date) break;
    if (!fromISO || run >= fromISO) out.push(run);
  }
  return out;
}

export interface Installment { n: number; label: 'down' | 'installment'; dueDate: string; amount: number }

/**
 * Splits `total` into a down payment plus equal installments. Amounts are rounded to
 * piastres; the rounding remainder lands on the final installment so the schedule
 * always sums exactly to the invoice total.
 */
export function buildInstallments(total: number, plan: Extract<PaymentPlan, { kind: 'installments' }>): Installment[] {
  const rows: Installment[] = [];
  const down = r2((total * plan.downPaymentPct) / 100);
  if (down > 0) rows.push({ n: 0, label: 'down', dueDate: plan.firstDueDate, amount: down });
  const rest = r2(total - down);
  const count = Math.max(1, plan.count);
  const each = Math.floor((rest / count) * 100) / 100;
  const firstOffset = down > 0 ? 1 : 0;
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? r2(rest - each * (count - 1)) : each;
    rows.push({ n: i + 1, label: 'installment', dueDate: addPeriods(plan.firstDueDate, plan.frequency, i + firstOffset), amount });
  }
  return rows;
}
