import type { DocumentTypeInfo, EtaDocument, EtaError, EtaStatus, SubmissionResponse, ValidationStep } from '../../../src/eta/types';

export type EtaEnv = 'simulator' | 'preprod' | 'production';

export interface EtaCredentials { clientId: string; clientSecret: string }

export interface EtaDocumentDetails {
  uuid: string; longId?: string; internalId?: string; submissionUUID?: string;
  status: EtaStatus; validationSteps: ValidationStep[];
  /** Pending state change requested by the counterparty, when reported. */
  cancelRequestDate?: string | null; rejectRequestDate?: string | null;
}

export interface EtaSearchResult {
  uuid: string; longId?: string; internalId: string; typeName: string; status: EtaStatus;
  issuerId: string; issuerName: string; receiverId?: string; receiverName?: string;
  dateTimeIssued: string; total: number;
}

export interface CodeUsageRequest { codeType: 'EGS'; parentCode: string; itemCode: string; codeName: string; codeNameAr: string; activeFrom: string; description: string; descriptionAr?: string; requestReason?: string }

/** Everything Fatura needs from ETA, one method per SDK operation. Implemented over HTTP and by the simulator. */
export interface EtaApi {
  readonly env: EtaEnv;
  login(): Promise<{ accessToken: string; expiresIn: number }>;
  getDocumentTypes(): Promise<DocumentTypeInfo[]>;
  submitDocuments(docs: EtaDocument[]): Promise<SubmissionResponse>;
  getSubmission(submissionId: string): Promise<{ overallStatus: string; documents: { uuid: string; internalId: string; status: EtaStatus }[] }>;
  getDocumentDetails(uuid: string): Promise<EtaDocumentDetails>;
  getDocumentPdf(uuid: string): Promise<Uint8Array>;
  /** Full document JSON as stored by ETA (GET /documents/{uuid}/raw). */
  getDocumentRaw(uuid: string): Promise<EtaDocument | undefined>;
  /** Receiver accepts the issuer's cancellation (ETA completes it when the decline window passes; the simulator applies it now). */
  acceptCancellation?(uuid: string): Promise<void>;
  cancelDocument(uuid: string, reason: string): Promise<void>;
  rejectDocument(uuid: string, reason: string): Promise<void>;
  declineCancellation(uuid: string): Promise<void>;
  declineRejection(uuid: string): Promise<void>;
  searchDocuments(q: { direction?: 'Sent' | 'Received'; submissionDateFrom?: string; submissionDateTo?: string; continuationToken?: string; pageSize?: number }): Promise<{ result: EtaSearchResult[]; continuationToken?: string }>;
  createEgsCodeUsage(items: CodeUsageRequest[]): Promise<{ passedItems: { itemCode: string }[]; failedItems: { itemCode: string; errors: string[] }[] }>;
  getMyCodeUsageRequests(): Promise<{ itemCode: string; status: 'Submitted' | 'Approved' | 'Rejected'; statusReason?: string }[]>;
  getCodeDetails(codeType: 'EGS' | 'GS1', itemCode: string): Promise<{ itemCode: string; codeName: string; active: boolean }>;
  requestCodeReuse(items: { codetype: 'EGS' | 'GS1'; itemCode: string; comment: string }[]): Promise<void>;
}

export class EtaApiError extends Error {
  constructor(public status: number, public error: EtaError | undefined, message: string, public retryable = false) { super(message); }
}
