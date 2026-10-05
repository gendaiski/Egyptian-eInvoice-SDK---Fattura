import { describe, expect, it } from 'vitest';
import { computeLine, computeTotals, type DraftLine } from './calc';

const base: DraftLine = {
  description: 'Consulting hour', itemType: 'EGS', itemCode: 'EG-123456789-001', unitType: 'HUR',
  quantity: 10, unitPrice: 1000, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }],
};

describe('computeLine', () => {
  it('applies 14% VAT on the net total', () => {
    const l = computeLine(base);
    expect(l.salesTotal).toBe(10000);
    expect(l.netTotal).toBe(10000);
    expect(l.taxableItems[0].amount).toBe(1400);
    expect(l.total).toBe(11400);
  });

  it('deducts the discount before tax and WHT from the total', () => {
    const l = computeLine({ ...base, discountRate: 10, taxes: [...base.taxes, { taxType: 'T4', subType: 'W004', rate: 3 }] });
    expect(l.discount).toEqual({ rate: 10, amount: 1000 });
    expect(l.netTotal).toBe(9000);
    expect(l.taxableItems.find((t) => t.taxType === 'T1')!.amount).toBe(1260);
    expect(l.taxableItems.find((t) => t.taxType === 'T4')!.amount).toBe(270);
    expect(l.total).toBe(9000 + 1260 - 270);
  });

  it('includes table tax and taxable fees in the VAT base', () => {
    const l = computeLine({
      ...base, quantity: 1, unitPrice: 100,
      taxes: [
        { taxType: 'T1', subType: 'V009', rate: 14 },
        { taxType: 'T2', subType: 'Tbl01', rate: 10 },
        { taxType: 'T3', subType: 'Tbl02', rate: 0, amount: 5 },
        { taxType: 'T5', subType: 'ST01', rate: 1 },
      ],
    });
    // fees = 1; T3 = 5; T2 = (100 + 1 + 5) × 10% = 10.6; T1 = (100 + 1 + 10.6 + 5) × 14% = 16.324
    expect(l.totalTaxableFees).toBe(1);
    expect(l.taxableItems.find((t) => t.taxType === 'T2')!.amount).toBe(10.6);
    expect(l.taxableItems.find((t) => t.taxType === 'T1')!.amount).toBe(16.324);
    expect(l.total).toBe(132.924);
  });

  it('converts foreign currency to EGP and keeps amountSold', () => {
    const l = computeLine({ ...base, quantity: 2, unitPrice: 50, currency: 'USD', exchangeRate: 48.5, taxes: [] });
    expect(l.unitValue).toEqual({ currencySold: 'USD', amountEGP: 2425, amountSold: 50, currencyExchangeRate: 48.5 });
    expect(l.salesTotal).toBe(4850);
  });

  it('keeps non-taxable fees out of the VAT base', () => {
    const l = computeLine({ ...base, quantity: 1, unitPrice: 100, taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }, { taxType: 'T13', subType: 'ST03', rate: 2 }] });
    expect(l.taxableItems.find((t) => t.taxType === 'T1')!.amount).toBe(14);
    expect(l.total).toBe(116);
  });
});

describe('computeTotals', () => {
  it('sums lines, groups taxes by type and subtracts the extra discount', () => {
    const a = computeLine(base);
    const b = computeLine({ ...base, unitPrice: 500, discountRate: 20 });
    const t = computeTotals([a, b], 100);
    expect(t.totalSalesAmount).toBe(15000);
    expect(t.totalDiscountAmount).toBe(1000);
    expect(t.netAmount).toBe(14000);
    expect(t.taxTotals).toEqual([{ taxType: 'T1', amount: 1960 }]);
    expect(t.totalAmount).toBe(15960 - 100);
  });
});
