import { describe, expect, it } from 'vitest';
import { computeLine, computeTotals } from './calc';
import type { EtaDocument } from './types';
import { hasErrors, preflight } from './validate';

const now = new Date('2026-10-05T10:00:00Z');
const line = computeLine({ description: 'Item', itemType: 'EGS', itemCode: 'EG-1', unitType: 'EA', quantity: 1, unitPrice: 60000, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }] });
const doc = (over: Partial<EtaDocument> = {}): EtaDocument => ({
  issuer: { type: 'B', id: '100200300', name: 'Acme', address: { branchID: '0', country: 'EG', governate: 'Cairo', regionCity: 'Nasr City', street: 'Abbas El Akkad', buildingNumber: '12' } },
  receiver: { type: 'B', id: '200300400', name: 'Client', address: { country: 'EG', governate: 'Giza', regionCity: 'Dokki', street: 'Tahrir', buildingNumber: '3' } },
  documentType: 'I', documentTypeVersion: '1.0', dateTimeIssued: now.toISOString(), taxpayerActivityCode: '6201', internalID: 'INV-1',
  invoiceLines: [line], ...computeTotals([line]), ...over,
});

describe('preflight', () => {
  it('passes a well-formed B2B invoice', () => {
    expect(preflight(doc(), { now })).toEqual([]);
  });
  it('requires a national ID for individuals above the threshold', () => {
    const issues = preflight(doc({ receiver: { type: 'P', name: 'Mona' } }), { now });
    expect(issues.map((i) => i.field)).toContain('receiver.id');
  });
  it('allows anonymous individuals below the threshold', () => {
    const small = computeLine({ ...line, description: 'x', itemType: 'EGS', itemCode: 'EG-1', unitType: 'EA', quantity: 1, unitPrice: 100, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }] });
    expect(hasErrors(preflight(doc({ receiver: { type: 'P' }, invoiceLines: [small], ...computeTotals([small]) }), { now }))).toBe(false);
  });
  it('rejects future dates and credit notes without references', () => {
    const issues = preflight(doc({ documentType: 'C', dateTimeIssued: '2026-10-06T10:00:00Z' }), { now });
    expect(issues.map((i) => i.field)).toEqual(expect.arrayContaining(['dateTimeIssued', 'references']));
  });
  it('flags duplicate internal numbers', () => {
    expect(preflight(doc(), { now, existingInternalIds: ['INV-1'] })[0].field).toBe('internalID');
  });
});
