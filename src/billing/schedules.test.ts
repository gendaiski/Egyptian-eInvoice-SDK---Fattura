import { describe, expect, it } from 'vitest';
import { addPeriods, buildInstallments, recurringRuns } from './schedules';

describe('addPeriods', () => {
  it('clamps month-end dates', () => {
    expect(addPeriods('2026-01-31', 'monthly', 1)).toBe('2026-02-28');
    expect(addPeriods('2026-01-31', 'quarterly', 1)).toBe('2026-04-30');
    expect(addPeriods('2026-03-10', 'weekly', 2)).toBe('2026-03-24');
  });
});

describe('recurringRuns', () => {
  it('stops after N runs or an end date', () => {
    const base = { kind: 'recurring' as const, frequency: 'monthly' as const, interval: 1, startDate: '2026-01-15', delivery: 'draft' as const, terms: 'net30' as const };
    expect(recurringRuns({ ...base, end: { type: 'after', count: 3 } }, 10)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15']);
    expect(recurringRuns({ ...base, end: { type: 'on', date: '2026-02-20' } }, 10)).toEqual(['2026-01-15', '2026-02-15']);
    expect(recurringRuns({ ...base, interval: 2, end: { type: 'never' } }, 3)).toEqual(['2026-01-15', '2026-03-15', '2026-05-15']);
  });
});

describe('buildInstallments', () => {
  it('sums exactly to the total with the remainder on the last row', () => {
    const rows = buildInstallments(1000, { kind: 'installments', count: 3, frequency: 'monthly', firstDueDate: '2026-11-01', downPaymentPct: 0 });
    expect(rows.map((r) => r.amount)).toEqual([333.33, 333.33, 333.34]);
    expect(rows.map((r) => r.dueDate)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']);
  });
  it('puts the down payment first and starts installments one period later', () => {
    const rows = buildInstallments(11400, { kind: 'installments', count: 4, frequency: 'monthly', firstDueDate: '2026-11-01', downPaymentPct: 25 });
    expect(rows[0]).toMatchObject({ label: 'down', amount: 2850, dueDate: '2026-11-01' });
    expect(rows[1].dueDate).toBe('2026-12-01');
    expect(rows.reduce((s, r) => s + r.amount, 0)).toBeCloseTo(11400, 2);
  });
});
