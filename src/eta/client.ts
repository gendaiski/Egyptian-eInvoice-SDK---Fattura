import type {
  CodeRequestStatus, DocumentTypeInfo, EtaDocument, EtaStatus, SubmissionOverallStatus, SubmissionResponse, ValidationStep,
} from './types';

/**
 * The ETA eInvoicing API surface Fatura depends on. One method per SDK operation;
 * the production implementation lives in the backend (secrets never reach the browser)
 * and the SPA talks to Fatura's own API, which proxies these calls per tenant.
 *
 * Environments
 *   Pre-production  id: https://id.preprod.eta.gov.eg   api: https://api.preprod.invoicing.eta.gov.eg
 *   Production      id: https://id.eta.gov.eg           api: https://api.invoicing.eta.gov.eg
 */
export interface EtaClient {
  /** POST {id}/connect/token — grant_type=client_credentials, scope=InvoicingAPI. Token lifetime ~1h. */
  login(clientId: string, clientSecret: string): Promise<{ access_token: string; expires_in: number }>;

  /** GET /api/v1.0/documenttypes — includes workflow parameters (cancel/reject windows). */
  getDocumentTypes(): Promise<DocumentTypeInfo[]>;

  /** POST /api/v1/documentsubmissions — signed documents, batched (size-limited per call). */
  submitDocuments(documents: EtaDocument[]): Promise<SubmissionResponse>;

  /** GET /api/v1.0/documentSubmissions/{submissionUuid} */
  getSubmission(submissionId: string): Promise<{ overallStatus: SubmissionOverallStatus; documentSummary: { uuid: string; status: EtaStatus }[] }>;

  /** GET /api/v1.0/documents/{uuid}/details — status plus validationResults.validationSteps. */
  getDocumentDetails(uuid: string): Promise<{ status: EtaStatus; validationSteps: ValidationStep[] }>;

  /** GET /api/v1.0/documents/{uuid}/pdf — ETA's official printout. */
  getDocumentPrintout(uuid: string): Promise<Blob>;

  /** PUT /api/v1.0/documents/state/{uuid}/state  { status: "cancelled", reason } — issuer only, within the window. */
  cancelDocument(uuid: string, reason: string): Promise<void>;

  /** PUT /api/v1.0/documents/state/{uuid}/state  { status: "rejected", reason } — receiver only, within the window. */
  rejectDocument(uuid: string, reason: string): Promise<void>;

  /** PUT /api/v1.0/documents/state/{uuid}/decline/cancelation — receiver declines the issuer's cancellation. */
  declineCancellation(uuid: string): Promise<void>;

  /** PUT /api/v1.0/documents/state/{uuid}/decline/rejection — issuer declines the receiver's rejection. */
  declineRejection(uuid: string): Promise<void>;

  /** GET /api/v1.0/documents/search — paginated by continuationToken; replaces Get Recent Documents. */
  searchDocuments(q: {
    direction?: 'Sent' | 'Received'; status?: EtaStatus; documentType?: string;
    issueDateFrom?: string; issueDateTo?: string; receiverId?: string; continuationToken?: string; pageSize?: number;
  }): Promise<{ result: { uuid: string; status: EtaStatus; internalId: string; total: number }[]; continuationToken?: string }>;

  /** POST /api/v1.0/documentPackages/requests then GET /api/v1.0/documentPackages/{rid} — bulk export. */
  requestDocumentPackage(q: { dateFrom: string; dateTo: string; format: 'JSON' | 'XML' }): Promise<{ requestId: string }>;

  /** POST /api/v1.0/codetypes/requests/codes — register internal (EGS) item codes for approval. */
  createEgsCodeUsage(items: { codeType: 'EGS'; parentCode: string; itemCode: string; codeName: string; codeNameAr: string; activeFrom: string; description: string }[]): Promise<{ passedItems: string[]; failedItems: { itemCode: string; errors: string[] }[] }>;

  /** GET /api/v1.0/codetypes/requests/my — status of code usage requests. */
  getMyCodeUsageRequests(): Promise<{ itemCode: string; status: CodeRequestStatus }[]>;

  /** GET /api/v1/notifications/taxpayer — portal notifications (e.g., cancellations on received documents). */
  getNotifications(): Promise<{ id: string; type: string; message: string; receivedAt: string }[]>;
}

export const ENDPOINTS = [
  { op: 'Login as taxpayer system', method: 'POST', path: '/connect/token', host: 'id' },
  { op: 'Get document types', method: 'GET', path: '/api/v1.0/documenttypes', host: 'api' },
  { op: 'Submit documents', method: 'POST', path: '/api/v1/documentsubmissions', host: 'api' },
  { op: 'Get submission', method: 'GET', path: '/api/v1.0/documentSubmissions/{uuid}', host: 'api' },
  { op: 'Get document details', method: 'GET', path: '/api/v1.0/documents/{uuid}/details', host: 'api' },
  { op: 'Get document printout', method: 'GET', path: '/api/v1.0/documents/{uuid}/pdf', host: 'api' },
  { op: 'Cancel / reject document', method: 'PUT', path: '/api/v1.0/documents/state/{uuid}/state', host: 'api' },
  { op: 'Decline cancellation', method: 'PUT', path: '/api/v1.0/documents/state/{uuid}/decline/cancelation', host: 'api' },
  { op: 'Decline rejection', method: 'PUT', path: '/api/v1.0/documents/state/{uuid}/decline/rejection', host: 'api' },
  { op: 'Search documents', method: 'GET', path: '/api/v1.0/documents/search', host: 'api' },
  { op: 'Request document package', method: 'POST', path: '/api/v1.0/documentPackages/requests', host: 'api' },
  { op: 'Create EGS code usage', method: 'POST', path: '/api/v1.0/codetypes/requests/codes', host: 'api' },
  { op: 'My code usage requests', method: 'GET', path: '/api/v1.0/codetypes/requests/my', host: 'api' },
  { op: 'Taxpayer notifications', method: 'GET', path: '/api/v1/notifications/taxpayer', host: 'api' },
  { op: 'Submit receipts (POS)', method: 'POST', path: '/api/v1/receiptsubmissions', host: 'api' },
] as const;

/** Public verification link printed as the QR code on every valid document. */
export const publicDocumentUrl = (uuid: string, longId: string, env: 'preprod' | 'production' = 'production') =>
  `https://${env === 'preprod' ? 'preprod.' : ''}invoicing.eta.gov.eg/documents/${uuid}/share/${longId}`;
