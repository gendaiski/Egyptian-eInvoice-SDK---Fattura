import type { DocumentTypeInfo, EtaDocument, EtaStatus, SubmissionResponse, ValidationStep } from './types';

/**
 * Deterministic in-browser stand-in for the ETA API so every flow in the UI can be
 * exercised without credentials. Validation outcomes follow simple, documented rules:
 *  - a line whose item code is not approved fails the "Code validator" step;
 *  - a B receiver whose RIN ends in "000" fails the "Taxpayer validator" step.
 */
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('');
const base32 = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => 'ABCDEFGHJKMNPQRSTVWXYZ0123456789'[b % 32]).join('');

export const newUuid = () => base32(26);
export const newLongId = () => base32(40).toLowerCase();

export const DOCUMENT_TYPES: DocumentTypeInfo[] = [
  { id: 1, code: 'I', name: 'Invoice', description: 'Sales invoice to an Egyptian or foreign receiver', activeVersion: '1.0', workflowParameters: { cancellationWindowHours: 168, rejectionWindowHours: 168, declineCancellationWindowHours: 168, declineRejectionWindowHours: 168 } },
  { id: 2, code: 'C', name: 'Credit note', description: 'Reduces the value of an issued invoice', activeVersion: '1.0', workflowParameters: { cancellationWindowHours: 168, rejectionWindowHours: 168, declineCancellationWindowHours: 168, declineRejectionWindowHours: 168 } },
  { id: 3, code: 'D', name: 'Debit note', description: 'Increases the value of an issued invoice', activeVersion: '1.0', workflowParameters: { cancellationWindowHours: 168, rejectionWindowHours: 168, declineCancellationWindowHours: 168, declineRejectionWindowHours: 168 } },
  { id: 4, code: 'EI', name: 'Export invoice', description: 'Invoice to a foreign company for exported goods or services', activeVersion: '1.0', workflowParameters: { cancellationWindowHours: 168, rejectionWindowHours: 168, declineCancellationWindowHours: 168, declineRejectionWindowHours: 168 } },
];

export const VALIDATORS = [
  'Structure validator', 'Core fields validator', 'Taxpayer validator', 'Issuer and receiver validator',
  'Code validator', 'Document totals validator', 'Signature validator', 'References validator',
];

export interface MockContext { approvedCodes: Set<string> }

export const mockEta = {
  async login() { await wait(500); return { access_token: hex(32), expires_in: 3600 }; },

  async getDocumentTypes() { await wait(150); return DOCUMENT_TYPES; },

  async submitDocuments(docs: EtaDocument[]): Promise<SubmissionResponse> {
    await wait(700 + docs.length * 60);
    return {
      submissionId: newUuid(),
      acceptedDocuments: docs.map((d) => ({ uuid: newUuid(), longId: newLongId(), internalId: d.internalID, hashKey: hex(32) })),
      rejectedDocuments: [],
    };
  },

  async getDocumentDetails(doc: EtaDocument, ctx: MockContext): Promise<{ status: EtaStatus; validationSteps: ValidationStep[] }> {
    await wait(900);
    return evaluate(doc, ctx);
  },

  async changeState() { await wait(500); },
  async createEgsCodeUsage() { await wait(600); },
};

export function evaluate(doc: EtaDocument, ctx: MockContext): { status: EtaStatus; validationSteps: ValidationStep[] } {
  const steps: ValidationStep[] = VALIDATORS.map((name) => ({ name, status: 'Valid' }));
  const fail = (name: string, code: string, message: string, propertyPath: string) => {
    const s = steps.find((x) => x.name === name)!;
    s.status = 'Invalid';
    s.error = { code, message, propertyPath, target: propertyPath };
  };
  const badLine = doc.invoiceLines.findIndex((l) => !ctx.approvedCodes.has(l.itemCode));
  if (badLine >= 0)
    fail('Code validator', 'ItemCodeNotActive', `Item code ${doc.invoiceLines[badLine].itemCode} is not approved for this taxpayer.`, `invoiceLines[${badLine}].itemCode`);
  if (doc.receiver.type === 'B' && doc.receiver.id?.endsWith('000'))
    fail('Taxpayer validator', 'ReceiverNotRegistered', `Receiver ${doc.receiver.id} is not an active registered taxpayer.`, 'receiver.id');
  return { status: steps.some((s) => s.status === 'Invalid') ? 'Invalid' : 'Valid', validationSteps: steps };
}
