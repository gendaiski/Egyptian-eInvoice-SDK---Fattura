/**
 * ETA eInvoicing document model (document type version 1.0).
 * Field names mirror the SDK JSON exactly so a document built in the UI can be
 * serialized, signed and submitted without a mapping layer.
 * Reference: https://sdk.invoicing.eta.gov.eg/documents/invoice-v1-0/
 */

/** B = Egyptian business (RIN), P = natural person (national ID), F = foreigner. */
export type PartyType = 'B' | 'P' | 'F';

/** I = invoice, C = credit note, D = debit note; E* = export variants.
 *  The authoritative list comes from GET /api/v1.0/documenttypes at runtime. */
export type DocumentTypeCode = 'I' | 'C' | 'D' | 'EI' | 'EC' | 'ED';

export interface Address {
  branchID?: string; // issuer only; "0" for the head office
  country: string; // ISO-3166 alpha-2
  governate: string;
  regionCity: string;
  street: string;
  buildingNumber: string;
  postalCode?: string;
  floor?: string;
  room?: string;
  landmark?: string;
  additionalInformation?: string;
}

export interface Party {
  type: PartyType;
  id?: string; // RIN for B, national ID for P, passport/other for F
  name?: string;
  address?: Address;
}

export interface UnitValue {
  currencySold: string; // ISO-4217, e.g. EGP, USD
  amountEGP: number;
  amountSold?: number; // mandatory when currencySold !== EGP
  currencyExchangeRate?: number;
}

export interface Discount { rate: number; amount: number }

export interface TaxableItem {
  taxType: string; // T1..T20
  amount: number;
  subType: string; // e.g. V009, W002
  rate: number; // percentage; 0 for fixed-amount taxes
}

export interface InvoiceLine {
  description: string;
  itemType: 'GS1' | 'EGS';
  itemCode: string;
  internalCode?: string;
  unitType: string; // ETA unit type code, e.g. EA, KGM
  quantity: number;
  unitValue: UnitValue;
  salesTotal: number;
  discount?: Discount;
  netTotal: number;
  taxableItems: TaxableItem[];
  itemsDiscount: number;
  valueDifference: number;
  totalTaxableFees: number;
  total: number;
}

export interface Payment {
  bankName?: string;
  bankAddress?: string;
  bankAccountNo?: string;
  bankAccountIBAN?: string;
  swiftCode?: string;
  terms?: string;
}

export interface Delivery {
  approach?: string;
  packaging?: string;
  dateValidity?: string;
  exportPort?: string;
  countryOfOrigin?: string;
  grossWeight?: number;
  netWeight?: number;
  terms?: string;
}

export interface TaxTotal { taxType: string; amount: number }

export interface Signature { signatureType: 'I' | 'S'; value: string }

export interface EtaDocument {
  issuer: Party;
  receiver: Party;
  documentType: DocumentTypeCode;
  documentTypeVersion: '1.0' | '0.9';
  dateTimeIssued: string; // UTC ISO-8601, never in the future
  taxpayerActivityCode: string;
  internalID: string;
  purchaseOrderReference?: string;
  purchaseOrderDescription?: string;
  salesOrderReference?: string;
  salesOrderDescription?: string;
  proformaInvoiceNumber?: string;
  references?: string[]; // ETA UUIDs of the original documents (credit/debit notes)
  payment?: Payment;
  delivery?: Delivery;
  invoiceLines: InvoiceLine[];
  totalSalesAmount: number;
  totalDiscountAmount: number;
  netAmount: number;
  taxTotals: TaxTotal[];
  extraDiscountAmount: number;
  totalItemsDiscountAmount: number;
  totalAmount: number;
  signatures?: Signature[];
}

/** Lifecycle status as reported by ETA. Draft/Signing are Fatura-only states. */
export type EtaStatus = 'Submitted' | 'Valid' | 'Invalid' | 'Rejected' | 'Cancelled';
export type DocStatus = 'Draft' | 'Signing' | EtaStatus;

export interface EtaError {
  code: string;
  message: string;
  target?: string;
  propertyPath?: string;
  details?: EtaError[];
}

export interface ValidationStep {
  name: string;
  status: 'Valid' | 'Invalid';
  error?: EtaError;
}

export interface SubmissionAccepted { uuid: string; longId: string; internalId: string; hashKey: string }
export interface SubmissionRejected { internalId: string; error: EtaError }

export interface SubmissionResponse {
  submissionId: string;
  acceptedDocuments: SubmissionAccepted[];
  rejectedDocuments: SubmissionRejected[];
}

export type SubmissionOverallStatus = 'InProgress' | 'Valid' | 'PartiallyValid' | 'Invalid';

/** Workflow parameters returned by Get Document Type — drives cancel/reject windows in the UI. */
export interface DocumentTypeInfo {
  id: number;
  name: string;
  description: string;
  code: DocumentTypeCode;
  activeVersion: string;
  workflowParameters: {
    cancellationWindowHours: number;
    rejectionWindowHours: number;
    declineCancellationWindowHours: number;
    declineRejectionWindowHours: number;
  };
}

export type CodeRequestStatus = 'Submitted' | 'Approved' | 'Rejected';
