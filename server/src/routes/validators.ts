import { z } from 'zod';

/** Request schemas. Entity bodies mirror src/store/model.ts; unknown keys are kept (passthrough) so the model can grow. */
const address = z.object({ country: z.string().length(2), governate: z.string(), regionCity: z.string(), street: z.string(), buildingNumber: z.string(), branchID: z.string().optional(), postalCode: z.string().optional(), floor: z.string().optional(), room: z.string().optional(), landmark: z.string().optional(), additionalInformation: z.string().optional() });
const party = z.object({ type: z.enum(['B', 'P', 'F']), id: z.string().optional(), name: z.string().optional(), address: address.partial().optional() });
const tax = z.object({ taxType: z.string().regex(/^T\d{1,2}$/), subType: z.string().min(2), rate: z.number().min(0).max(100), amount: z.number().min(0).optional() });
const line = z.object({
  description: z.string().max(500), itemType: z.enum(['GS1', 'EGS']), itemCode: z.string().max(100), internalCode: z.string().optional(), unitType: z.string().max(10),
  quantity: z.number().min(0), unitPrice: z.number().min(0), currency: z.string().length(3), exchangeRate: z.number().positive().optional(),
  discountRate: z.number().min(0).max(100).optional(), itemsDiscount: z.number().min(0).optional(), valueDifference: z.number().optional(), taxes: z.array(tax).max(20), itemId: z.string().optional(),
});
const terms = z.enum(['receipt', 'net15', 'net30', 'net45', 'net60']);
const frequency = z.enum(['weekly', 'monthly', 'quarterly', 'yearly']);
const plan = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('one-time'), terms }),
  z.object({ kind: z.literal('recurring'), frequency, interval: z.number().int().min(1).max(12), startDate: z.string(), end: z.union([z.object({ type: z.literal('never') }), z.object({ type: z.literal('after'), count: z.number().int().min(1) }), z.object({ type: z.literal('on'), date: z.string() })]), delivery: z.enum(['draft', 'submit', 'submit_email']), terms }),
  z.object({ kind: z.literal('installments'), count: z.number().int().min(1).max(60), frequency, firstDueDate: z.string(), downPaymentPct: z.number().min(0).max(90) }),
]);

export const S = {
  doc: z.object({
    id: z.string().min(1).max(64), documentType: z.enum(['I', 'C', 'D', 'EI', 'EC', 'ED']), internalID: z.string().max(50), counterparty: party, customerId: z.string().optional(),
    branchId: z.string(), activityCode: z.string().max(10), issuedAt: z.string(), lines: z.array(line).min(1).max(1000), extraDiscount: z.number().min(0),
    references: z.array(z.string()).optional(), poRef: z.string().max(100).optional(), notes: z.string().max(2000).optional(), plan, recurringId: z.string().optional(),
  }).passthrough(),
  customer: z.object({ id: z.string().min(1), type: z.enum(['B', 'P', 'F']), taxId: z.string().max(30), name: z.string().min(1).max(200), nameAr: z.string().optional(), email: z.string(), phone: z.string().optional(), address, terms, currency: z.string().length(3) }).passthrough(),
  item: z.object({ id: z.string().min(1), name: z.string().min(1), nameAr: z.string(), itemType: z.enum(['EGS', 'GS1']), itemCode: z.string().min(1), internalCode: z.string(), gpcCode: z.string(), unitType: z.string(), price: z.number().min(0), currency: z.string().length(3), taxes: z.array(tax) }).passthrough(),
  recurring: z.object({ id: z.string().min(1), name: z.string().min(1), customerId: z.string(), lines: z.array(line).min(1), branchId: z.string(), plan, status: z.enum(['active', 'paused', 'ended']) }).passthrough(),
  company: z.object({ name: z.string().min(1), nameAr: z.string(), rin: z.string().regex(/^\d{9}$/), activityCode: z.string(), email: z.string(), phone: z.string(), iban: z.string(), bankName: z.string(), branches: z.array(z.object({ id: z.string(), code: z.string(), name: z.string(), nameAr: z.string(), address })).min(1) }).passthrough(),
  integration: z.object({ env: z.enum(['simulator', 'preprod', 'production']), clientId: z.string().max(200) }).passthrough(),
  signing: z.object({ method: z.enum(['usb-token', 'hsm', 'cloud', 'test-certificate']) }).passthrough(),
  settings: z.object({ numbering: z.record(z.string(), z.object({ pattern: z.string().min(1).max(40), next: z.number().int().min(1) })), defaultTerms: terms, autoEmail: z.boolean() }).passthrough(),
  payment: z.object({ date: z.string(), amount: z.number().positive(), method: z.enum(['bank', 'cash', 'card', 'cheque', 'instapay']), note: z.string().optional() }),
  reason: z.object({ reason: z.string().min(3).max(500) }),
  signup: z.object({ name: z.string().min(2), company: z.string().min(1), email: z.string().email(), password: z.string().min(8), plan: z.string().optional(), billing: z.enum(['monthly', 'yearly', 'installments', 'one-time']).optional() }),
  login: z.object({ email: z.string().email(), password: z.string().min(1) }),
  lead: z.object({ name: z.string().min(2), email: z.string().email(), company: z.string().min(1), phone: z.string().optional(), topic: z.enum(['demo', 'sales', 'support', 'partnership']), message: z.string().min(10).max(4000), planId: z.string().optional(), billing: z.string().optional(), docsPerMonth: z.number().optional() }).passthrough(),
  ext: {
    document: z.object({
      type: z.enum(['I', 'C', 'D', 'EI']).default('I'),
      internal_id: z.string().max(50).optional(),
      customer: z.union([z.string(), party.extend({ name: z.string(), address: address.optional() })]),
      lines: z.array(z.object({ item: z.string().optional(), description: z.string().optional(), item_code: z.string().optional(), item_type: z.enum(['EGS', 'GS1']).optional(), unit_type: z.string().optional(), quantity: z.number().positive(), unit_price: z.number().min(0).optional(), currency: z.string().length(3).optional(), exchange_rate: z.number().positive().optional(), discount_rate: z.number().min(0).max(100).optional(), taxes: z.array(tax).optional() })).min(1),
      references: z.array(z.string()).optional(),
      payment_plan: z.union([plan, z.object({ kind: z.literal('installments'), count: z.number().int(), down_payment_pct: z.number().optional(), frequency: frequency.optional() })]).optional(),
      branch: z.string().optional(), notes: z.string().optional(), po_ref: z.string().optional(), issued_at: z.string().optional(),
      submit: z.boolean().default(false),
    }),
  },
};
