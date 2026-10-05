import { taxKind } from './codes';
import type { InvoiceLine, TaxTotal, TaxableItem } from './types';

/** ETA accepts up to 5 decimal places on amounts. Round once per computed field. */
export const r5 = (n: number) => Math.round((n + Number.EPSILON) * 1e5) / 1e5;
export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface DraftTax { taxType: string; subType: string; rate: number; amount?: number }

export interface DraftLine {
  description: string;
  itemType: 'GS1' | 'EGS';
  itemCode: string;
  internalCode?: string;
  unitType: string;
  quantity: number;
  /** Price per unit in `currency`. */
  unitPrice: number;
  currency: string;
  /** EGP per 1 unit of `currency`; ignored for EGP. */
  exchangeRate?: number;
  /** Discount before tax, as a percentage of the sales total. */
  discountRate?: number;
  /** Non-taxable discount applied after tax. */
  itemsDiscount?: number;
  valueDifference?: number;
  taxes: DraftTax[];
}

/**
 * Computes a single ETA invoice line following the SDK calculation rules:
 *   salesTotal       = quantity × unitValue.amountEGP
 *   netTotal         = salesTotal − discount.amount
 *   taxable fees     (T5–T12) = rate × netTotal, or a fixed amount
 *   T3 (fixed)       = fixed amount
 *   T2               = rate × (netTotal + totalTaxableFees + valueDifference + T3)
 *   T1 (VAT)         = rate × (netTotal + totalTaxableFees + valueDifference + T2 + T3)
 *   T4 (WHT)         = rate × (netTotal − itemsDiscount)
 *   non-taxable fees (T13–T20) = rate × netTotal, or a fixed amount
 *   total            = netTotal + totalTaxableFees + nonTaxableFees + T1 + T2 + T3 − T4 − itemsDiscount
 */
export function computeLine(d: DraftLine): InvoiceLine {
  const isEGP = d.currency === 'EGP';
  const rate = isEGP ? 1 : d.exchangeRate ?? 0;
  const amountEGP = r5(d.unitPrice * rate);
  const salesTotal = r5(d.quantity * amountEGP);
  const discountAmount = r5((salesTotal * (d.discountRate ?? 0)) / 100);
  const netTotal = r5(salesTotal - discountAmount);
  const itemsDiscount = r5(d.itemsDiscount ?? 0);
  const valueDifference = r5(d.valueDifference ?? 0);

  const amounts = new Map<DraftTax, number>();
  const pctOr = (t: DraftTax, base: number) => (t.rate ? r5((base * t.rate) / 100) : r5(t.amount ?? 0));

  let taxableFees = 0;
  let nonTaxableFees = 0;
  for (const t of d.taxes) {
    const kind = taxKind(t.taxType);
    if (kind === 'taxable-fee') { const a = pctOr(t, netTotal); amounts.set(t, a); taxableFees += a; }
    if (kind === 'non-taxable-fee') { const a = pctOr(t, netTotal); amounts.set(t, a); nonTaxableFees += a; }
    if (kind === 'table-fixed') amounts.set(t, r5(t.amount ?? 0));
  }
  taxableFees = r5(taxableFees);
  const sumKind = (k: string) => d.taxes.filter((t) => taxKind(t.taxType) === k).reduce((s, t) => s + (amounts.get(t) ?? 0), 0);

  const t3 = sumKind('table-fixed');
  for (const t of d.taxes.filter((t) => taxKind(t.taxType) === 'table-rate')) {
    amounts.set(t, r5(((netTotal + taxableFees + valueDifference + t3) * t.rate) / 100));
  }
  const t2 = sumKind('table-rate');
  for (const t of d.taxes.filter((t) => taxKind(t.taxType) === 'vat')) {
    amounts.set(t, r5(((netTotal + taxableFees + valueDifference + t2 + t3) * t.rate) / 100));
  }
  for (const t of d.taxes.filter((t) => taxKind(t.taxType) === 'withholding')) {
    amounts.set(t, r5(((netTotal - itemsDiscount) * t.rate) / 100));
  }
  const t1 = sumKind('vat');
  const t4 = sumKind('withholding');

  const taxableItems: TaxableItem[] = d.taxes.map((t) => ({
    taxType: t.taxType,
    subType: t.subType,
    rate: t.rate,
    amount: amounts.get(t) ?? 0,
  }));

  const total = r5(netTotal + taxableFees + nonTaxableFees + t1 + t2 + t3 - t4 - itemsDiscount);

  return {
    description: d.description,
    itemType: d.itemType,
    itemCode: d.itemCode,
    internalCode: d.internalCode,
    unitType: d.unitType,
    quantity: d.quantity,
    unitValue: isEGP
      ? { currencySold: 'EGP', amountEGP }
      : { currencySold: d.currency, amountEGP, amountSold: d.unitPrice, currencyExchangeRate: rate },
    salesTotal,
    discount: { rate: d.discountRate ?? 0, amount: discountAmount },
    netTotal,
    taxableItems,
    itemsDiscount,
    valueDifference,
    totalTaxableFees: taxableFees,
    total,
  };
}

export interface DocumentTotals {
  totalSalesAmount: number;
  totalDiscountAmount: number;
  netAmount: number;
  taxTotals: TaxTotal[];
  extraDiscountAmount: number;
  totalItemsDiscountAmount: number;
  totalAmount: number;
}

export function computeTotals(lines: InvoiceLine[], extraDiscountAmount = 0): DocumentTotals {
  const sum = (f: (l: InvoiceLine) => number) => r5(lines.reduce((s, l) => s + f(l), 0));
  const byType = new Map<string, number>();
  for (const l of lines) for (const t of l.taxableItems) byType.set(t.taxType, (byType.get(t.taxType) ?? 0) + t.amount);
  const taxTotals = [...byType.entries()]
    .sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)))
    .map(([taxType, amount]) => ({ taxType, amount: r5(amount) }));
  return {
    totalSalesAmount: sum((l) => l.salesTotal),
    totalDiscountAmount: sum((l) => l.discount?.amount ?? 0),
    netAmount: sum((l) => l.netTotal),
    taxTotals,
    extraDiscountAmount: r5(extraDiscountAmount),
    totalItemsDiscountAmount: sum((l) => l.itemsDiscount),
    totalAmount: r5(sum((l) => l.total) - extraDiscountAmount),
  };
}
