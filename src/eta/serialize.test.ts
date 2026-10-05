import { describe, expect, it } from 'vitest';
import { documentHash, serializeForSigning } from './serialize';

describe('serializeForSigning', () => {
  it('upper-cases names, quotes values and repeats array names', () => {
    const s = serializeForSigning({ issuer: { type: 'B', id: '123' }, invoiceLines: [{ quantity: 1 }, { quantity: 2 }], totalAmount: 10.5 });
    expect(s).toBe('"ISSUER""TYPE""B""ID""123""INVOICELINES""INVOICELINES""QUANTITY""1""INVOICELINES""QUANTITY""2""TOTALAMOUNT""10.5"');
  });

  it('excludes signatures and nulls', () => {
    expect(serializeForSigning({ a: 1, signatures: [{ value: 'x' }], b: null })).toBe('"A""1"');
  });

  it('hashes deterministically', async () => {
    const h = await documentHash({ a: 1 });
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(await documentHash({ a: 1 })).toBe(h);
  });
});
