import type { Installment, PaymentPlan, PaymentTerms } from '@/billing/schedules';
import { computeLine, computeTotals, type DraftLine, type DraftTax } from '@/eta/calc';
import type {
  Address, CodeRequestStatus, DocStatus, DocumentTypeCode, EtaDocument, Party, PartyType, SubmissionOverallStatus, ValidationStep,
} from '@/eta/types';

export type Bi = { en: string; ar: string };

export interface Branch { id: string; code: string; name: string; nameAr: string; address: Address }
export interface Company {
  name: string; nameAr: string; rin: string; activityCode: string; email: string; phone: string;
  branches: Branch[]; iban: string; bankName: string;
}
export interface Integration {
  env: 'preprod' | 'production'; clientId: string; secretSet: boolean;
  status: 'connected' | 'error' | 'not_configured'; lastTokenAt?: string; posSerial?: string;
}
export interface Signing {
  method: 'usb-token' | 'hsm' | 'cloud';
  agent: { status: 'online' | 'offline'; version: string; host: string; lastSeen: string };
  certificate: { subject: string; issuer: string; serial: string; expires: string };
}
export interface Customer {
  id: string; type: PartyType; taxId: string; name: string; nameAr?: string; email: string; phone?: string;
  address: Address; terms: PaymentTerms; currency: string; createdAt: string;
}
export interface Item {
  id: string; name: string; nameAr: string; itemType: 'EGS' | 'GS1'; itemCode: string; internalCode: string;
  gpcCode: string; unitType: string; price: number; currency: string; taxes: DraftTax[];
  codeStatus: CodeRequestStatus; codeRequestedAt: string;
}
export interface DocLine extends DraftLine { itemId?: string }
export interface PaymentRecord { id: string; date: string; amount: number; method: 'bank' | 'cash' | 'card' | 'cheque' | 'instapay'; note?: string }
export interface InstallmentRow extends Installment { paid: number }
export interface DocEvent { at: string; type: string; by: string; note?: string }

export interface Doc {
  id: string;
  direction: 'sent' | 'received';
  documentType: DocumentTypeCode;
  internalID: string;
  status: DocStatus;
  /** Sent: the receiver. Received: the issuer. Snapshot at issue time. */
  counterparty: Party;
  customerId?: string;
  branchId: string;
  activityCode: string;
  issuedAt: string;
  lines: DocLine[];
  extraDiscount: number;
  references?: string[];
  poRef?: string;
  notes?: string;
  plan: PaymentPlan;
  installments?: InstallmentRow[];
  payments: PaymentRecord[];
  uuid?: string;
  longId?: string;
  submissionId?: string;
  submittedAt?: string;
  validatedAt?: string;
  steps?: ValidationStep[];
  stateChangedAt?: string;
  stateReason?: string;
  /** Received docs: the issuer asked to cancel — the receiver may decline. Sent docs: the receiver rejected — issuer may decline. */
  pending?: 'cancellation_requested' | 'rejection_requested';
  recurringId?: string;
  events: DocEvent[];
}

export interface Recurring {
  id: string; name: string; customerId: string; lines: DocLine[]; branchId: string;
  plan: Extract<PaymentPlan, { kind: 'recurring' }>;
  status: 'active' | 'paused' | 'ended'; nextRun?: string; lastRun?: string; generatedIds: string[]; createdAt: string;
}
export interface Submission { id: string; at: string; docIds: string[]; accepted: number; rejected: number; status: SubmissionOverallStatus; ms: number; by: string }
export interface Receipt {
  id: string; number: string; uuid: string; at: string; branchId: string; device: string; type: 'S' | 'R';
  buyerType: 'P' | 'B' | 'F'; total: number; vat: number; method: 'C' | 'V' | 'W'; status: 'Valid' | 'Invalid' | 'Submitted';
}
export interface Member { id: string; name: string; email: string; role: 'Owner' | 'Admin' | 'Accountant' | 'Sales' | 'Viewer'; status: 'active' | 'invited'; lastActive?: string }
export interface Notice { id: string; at: string; tone: 'ok' | 'bad' | 'warn' | 'info'; text: Bi; to?: string; read: boolean }

/* ---------- Platform admin ---------- */
export type BillingModel = 'one-time' | 'recurring' | 'installments';
export interface Plan {
  id: string; name: string; nameAr: string; blurb: Bi; docsPerMonth: number; users: number; branches: number;
  features: Bi[]; monthly: number; yearly: number; oneTime: number; installments: { count: number; amount: number }; featured?: boolean; active: boolean;
}
export interface Tenant {
  id: string; name: string; rin: string; owner: string; governorate: string; planId: string; model: BillingModel; cycle?: 'monthly' | 'yearly';
  status: 'active' | 'trial' | 'past_due' | 'suspended'; env: 'preprod' | 'production'; docsThisMonth: number; invalidRate: number;
  signer: 'online' | 'offline'; mrr: number; createdAt: string; installmentsPaid?: number;
}
export interface PlatformInvoice {
  id: string; number: string; tenantId: string; issuedAt: string; dueAt: string; amount: number; vat: number;
  model: BillingModel; installment?: string; status: 'paid' | 'open' | 'overdue' | 'void'; etaStatus: 'Valid' | 'Submitted' | 'Invalid';
}
export interface AuditEntry { id: string; at: string; actor: string; tenantId?: string; action: string; target: string; ip: string }
export interface AdminUser { id: string; name: string; email: string; role: 'Super admin' | 'Support' | 'Finance' | 'Read-only'; mfa: boolean; lastActive: string }
export interface RefTable { id: string; name: Bi; source: string; count: number; syncedAt: string; status: 'ok' | 'stale' | 'error' }
export interface ApiDay { date: string; submitted: number; valid: number; invalid: number; errors: number; p95: number }

export interface DB {
  version: number;
  session: { signedIn: boolean; onboarded: boolean; user: { name: string; email: string } };
  company: Company; integration: Integration; signing: Signing;
  settings: { numbering: Record<'I' | 'C' | 'D' | 'EI', { pattern: string; next: number }>; personIdThreshold: number; defaultTerms: PaymentTerms; autoEmail: boolean };
  customers: Customer[]; items: Item[]; docs: Doc[]; recurring: Recurring[]; submissions: Submission[];
  receipts: Receipt[]; members: Member[]; notices: Notice[];
  admin: { plans: Plan[]; tenants: Tenant[]; invoices: PlatformInvoice[]; audit: AuditEntry[]; users: AdminUser[]; refs: RefTable[]; api: ApiDay[] };
}

/* ---------- Derived helpers ---------- */

export const computeDoc = (d: Pick<Doc, 'lines' | 'extraDiscount'>) => {
  const lines = d.lines.map(computeLine);
  return { lines, totals: computeTotals(lines, d.extraDiscount) };
};

export const docTotal = (d: Doc) => computeDoc(d).totals.totalAmount;
export const docVat = (d: Doc) => computeDoc(d).totals.taxTotals.find((t) => t.taxType === 'T1')?.amount ?? 0;
export const paidAmount = (d: Doc) => d.payments.reduce((s, p) => s + p.amount, 0);

export function companyParty(c: Company, branchId: string): Party {
  const b = c.branches.find((x) => x.id === branchId) ?? c.branches[0];
  return { type: 'B', id: c.rin, name: c.name, address: { ...b.address, branchID: b.code } };
}

/** Builds the exact ETA v1.0 JSON for a Fatura document. */
export function toEtaDocument(d: Doc, c: Company): EtaDocument {
  const { lines, totals } = computeDoc(d);
  const self = companyParty(c, d.branchId);
  return {
    issuer: d.direction === 'sent' ? self : d.counterparty,
    receiver: d.direction === 'sent' ? d.counterparty : { type: 'B', id: c.rin, name: c.name, address: self.address },
    documentType: d.documentType,
    documentTypeVersion: '1.0',
    dateTimeIssued: d.issuedAt,
    taxpayerActivityCode: d.activityCode,
    internalID: d.internalID,
    purchaseOrderReference: d.poRef || undefined,
    references: d.references?.length ? d.references : undefined,
    payment: d.direction === 'sent' ? { bankName: c.bankName, bankAccountIBAN: c.iban, terms: d.notes } : undefined,
    invoiceLines: lines,
    ...totals,
  };
}

export type DueState = 'paid' | 'partial' | 'overdue' | 'due' | 'na';

export function dueInfo(d: Doc, today = new Date().toISOString().slice(0, 10)): { state: DueState; dueDate?: string; outstanding: number } {
  if (d.direction !== 'sent' || d.documentType !== 'I' && d.documentType !== 'EI' || d.status !== 'Valid') return { state: 'na', outstanding: 0 };
  const total = docTotal(d);
  const outstanding = Math.max(0, Math.round((total - paidAmount(d)) * 100) / 100);
  let due: string | undefined;
  if (d.installments?.length) due = d.installments.find((i) => i.paid < i.amount - 0.005)?.dueDate;
  else if (d.plan.kind !== 'installments') {
    const days = { receipt: 0, net15: 15, net30: 30, net45: 45, net60: 60 }[d.plan.terms];
    const dt = new Date(d.issuedAt); dt.setUTCDate(dt.getUTCDate() + days); due = dt.toISOString().slice(0, 10);
  }
  if (outstanding <= 0.005) return { state: 'paid', dueDate: due, outstanding: 0 };
  if (due && due < today) return { state: 'overdue', dueDate: due, outstanding };
  return { state: paidAmount(d) > 0 ? 'partial' : 'due', dueDate: due, outstanding };
}

/** Hours left in the ETA cancel/reject window (from the document type's workflow parameters). */
export function windowHoursLeft(d: Doc, windowHours = 168, now = Date.now()): number {
  if (!d.validatedAt) return 0;
  return Math.max(0, windowHours - (now - new Date(d.validatedAt).getTime()) / 3_600_000);
}

export const formatNumber = (pattern: string, n: number, date = new Date()) =>
  pattern.replace('{YYYY}', String(date.getFullYear())).replace(/\{(#+)\}/, (_, h: string) => String(n).padStart(h.length, '0'));

export const uid = (p = '') => p + Math.random().toString(36).slice(2, 10);
