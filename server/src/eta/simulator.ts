import { createHash, randomBytes } from 'node:crypto';
import { serializeForSigning } from '../../../src/eta/serialize';
import type { DocumentTypeInfo, EtaDocument, EtaStatus, SubmissionResponse, ValidationStep } from '../../../src/eta/types';
import { preflight } from '../../../src/eta/validate';
import { DOCUMENT_TYPES, VALIDATORS } from '../../../src/eta/mockClient';
import type { Db } from '../db/client';
import { verifyCades } from '../signing/cades';
import { EtaApiError, type CodeUsageRequest, type EtaApi, type EtaDocumentDetails, type EtaSearchResult } from './types';

interface SimDoc {
  uuid: string; longId: string; internalId: string; submissionId: string; typeName: string;
  issuerId: string; issuerName: string; receiverId?: string; receiverName?: string;
  status: EtaStatus; steps: ValidationStep[]; submittedAt: string; validatedAt: string; dateTimeIssued: string; total: number;
  cancelRequestDate?: string | null; rejectRequestDate?: string | null; declined?: 'cancellation' | 'rejection';
}

const base32 = (n: number) => Array.from(randomBytes(n), (b) => 'ABCDEFGHJKMNPQRSTVWXYZ0123456789'[b % 32]).join('');
const CODE_REVIEW_MS = 60_000;

/**
 * An in-process stand-in for ETA that behaves like the real service for everything Fatura does:
 * it validates structure and totals with the official rules, checks item codes against the codes
 * this taxpayer registered, verifies the CAdES-BES signature, enforces cancel/reject windows, and
 * routes documents between taxpayers by RIN (so one tenant's invoice shows up in the other's inbox).
 * State lives in the `platform` table, so it survives restarts.
 */
export class SimulatorEta implements EtaApi {
  readonly env = 'simulator' as const;
  constructor(private db: Db, private rin: string, private opts: { requireValidSignature?: boolean } = {}) {}

  async login() { return { accessToken: 'sim_' + base32(16), expiresIn: 3600 }; }
  async getDocumentTypes(): Promise<DocumentTypeInfo[]> { return DOCUMENT_TYPES; }

  private async put(kind: string, id: string, data: unknown) {
    await this.db.query('INSERT INTO platform (kind, id, data) VALUES ($1,$2,$3) ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()', [kind, id, JSON.stringify(data)]);
  }
  private async get<T>(kind: string, id: string): Promise<T | undefined> {
    const [r] = await this.db.query<{ data: T }>('SELECT data FROM platform WHERE kind = $1 AND id = $2', [kind, id]);
    return r?.data;
  }

  async submitDocuments(docs: EtaDocument[]): Promise<SubmissionResponse> {
    if (docs.length > 100) throw new EtaApiError(400, { code: 'BadArgument', message: 'A submission may contain at most 100 documents.' }, 'Too many documents in one submission.');
    const submissionId = base32(26);
    const res: SubmissionResponse = { submissionId, acceptedDocuments: [], rejectedDocuments: [] };
    for (const doc of docs) {
      if (doc.issuer.id !== this.rin) { res.rejectedDocuments.push({ internalId: doc.internalID, error: { code: 'IssuerMismatch', message: 'Issuer does not match the authenticated taxpayer.', target: 'issuer.id' } }); continue; }
      if (!doc.signatures?.length && doc.documentTypeVersion === '1.0') { res.rejectedDocuments.push({ internalId: doc.internalID, error: { code: 'SignatureMissing', message: 'Version 1.0 documents must be signed.', target: 'signatures' } }); continue; }
      const uuid = base32(26), longId = base32(40).toLowerCase();
      const steps = await this.validate(doc);
      const now = new Date().toISOString();
      const sim: SimDoc = {
        uuid, longId, internalId: doc.internalID, submissionId, typeName: doc.documentType,
        issuerId: doc.issuer.id!, issuerName: doc.issuer.name ?? '', receiverId: doc.receiver.id, receiverName: doc.receiver.name,
        status: steps.some((s) => s.status === 'Invalid') ? 'Invalid' : 'Valid', steps, submittedAt: now, validatedAt: now,
        dateTimeIssued: doc.dateTimeIssued, total: doc.totalAmount,
      };
      await this.put('sim_doc', uuid, sim);
      await this.put('sim_doc_body', uuid, doc);
      res.acceptedDocuments.push({ uuid, longId, internalId: doc.internalID, hashKey: createHash('sha256').update(serializeForSigning(doc)).digest('hex') });
    }
    await this.put('sim_submission', submissionId, { uuids: res.acceptedDocuments.map((a) => a.uuid), rin: this.rin });
    return res;
  }

  private async validate(doc: EtaDocument): Promise<ValidationStep[]> {
    const steps: ValidationStep[] = VALIDATORS.map((name) => ({ name, status: 'Valid' }));
    const fail = (name: string, code: string, message: string, propertyPath: string) => {
      const s = steps.find((x) => x.name === name)!;
      if (s.status === 'Invalid') return;
      s.status = 'Invalid'; s.error = { code, message, propertyPath, target: propertyPath };
    };
    for (const issue of preflight(doc, { maxBackdateDays: 7 }).filter((i) => i.level === 'error')) {
      const validator = issue.field.startsWith('receiver') || issue.field.startsWith('issuer') ? 'Issuer and receiver validator' : issue.field === 'references' ? 'References validator' : 'Core fields validator';
      fail(validator, 'RuleViolation', issue.en, issue.field);
    }
    for (const [i, l] of doc.invoiceLines.entries()) {
      if (l.itemType === 'GS1') continue;
      const reg = await this.get<{ status: string }>('sim_code', `${this.rin}:${l.itemCode}`);
      if (reg?.status !== 'Approved') fail('Code validator', 'ItemCodeNotActive', `Item code ${l.itemCode} is not active for this taxpayer.`, `invoiceLines[${i}].itemCode`);
    }
    if (doc.receiver.type === 'B' && doc.receiver.id?.endsWith('000')) fail('Taxpayer validator', 'ReceiverNotRegistered', `Receiver ${doc.receiver.id} is not an active registered taxpayer.`, 'receiver.id');
    if (doc.references?.length) {
      for (const ref of doc.references) {
        const orig = await this.get<SimDoc>('sim_doc', ref);
        if (!orig || orig.status !== 'Valid' || orig.issuerId !== this.rin) fail('References validator', 'ReferenceNotFound', `Referenced document ${ref} was not found or is not valid.`, 'references');
      }
    }
    const sig = doc.signatures?.find((s) => s.signatureType === 'I');
    if (sig) {
      const { signatures: _omit, ...unsigned } = doc;
      const v = await verifyCades(sig.value, serializeForSigning(unsigned));
      if (!v.ok) fail('Signature validator', 'SignatureInvalid', 'The issuer signature does not match the document content.', 'signatures[0]');
    } else if (this.opts.requireValidSignature !== false && doc.documentTypeVersion === '1.0') fail('Signature validator', 'SignatureMissing', 'Issuer signature is missing.', 'signatures');
    return steps;
  }

  async getSubmission(submissionId: string) {
    const s = await this.get<{ uuids: string[] }>('sim_submission', submissionId);
    if (!s) throw new EtaApiError(404, { code: 'NotFound', message: 'Submission not found.' }, 'Submission not found.');
    const docs = await Promise.all(s.uuids.map((u) => this.get<SimDoc>('sim_doc', u)));
    const list = docs.filter(Boolean).map((d) => ({ uuid: d!.uuid, internalId: d!.internalId, status: d!.status }));
    const invalid = list.filter((d) => d.status === 'Invalid').length;
    return { overallStatus: invalid === 0 ? 'Valid' : invalid === list.length ? 'Invalid' : 'PartiallyValid', documents: list };
  }

  private async mustOwnOrReceive(uuid: string): Promise<SimDoc> {
    const d = await this.get<SimDoc>('sim_doc', uuid);
    if (!d || (d.issuerId !== this.rin && d.receiverId !== this.rin)) throw new EtaApiError(404, { code: 'NotFound', message: 'Document not found.' }, 'Document not found.');
    return d;
  }

  async getDocumentDetails(uuid: string): Promise<EtaDocumentDetails> {
    const d = await this.mustOwnOrReceive(uuid);
    return { uuid: d.uuid, longId: d.longId, internalId: d.internalId, submissionUUID: d.submissionId, status: d.status, validationSteps: d.steps, cancelRequestDate: d.cancelRequestDate, rejectRequestDate: d.rejectRequestDate };
  }

  async getDocumentPdf(uuid: string) {
    const d = await this.mustOwnOrReceive(uuid);
    const text = `%PDF-1.4\n% Fatura ETA simulator printout\n% ${d.internalId} ${d.uuid} ${d.status}\n%%EOF\n`;
    return new TextEncoder().encode(text);
  }

  private windowOpen(d: SimDoc) { return Date.now() - new Date(d.validatedAt).getTime() < DOCUMENT_TYPES[0].workflowParameters.cancellationWindowHours * 3_600_000; }

  async cancelDocument(uuid: string, reason: string) {
    const d = await this.mustOwnOrReceive(uuid);
    if (d.issuerId !== this.rin) throw new EtaApiError(403, { code: 'Forbidden', message: 'Only the issuer can cancel a document.' }, 'Only the issuer can cancel.');
    if (d.status !== 'Valid' || !this.windowOpen(d)) throw new EtaApiError(400, { code: 'OperationPeriodOver', message: 'The cancellation window has closed or the document is not valid.' }, 'Cannot cancel this document.');
    // Cancelled now; a business receiver is notified and may decline within its window, which restores Valid.
    d.status = 'Cancelled';
    if (d.receiverId && d.receiverId !== this.rin && /^\d{9}$/.test(d.receiverId)) d.cancelRequestDate = new Date().toISOString();
    await this.put('sim_doc', uuid, { ...d, reason });
  }

  async rejectDocument(uuid: string, reason: string) {
    const d = await this.mustOwnOrReceive(uuid);
    if (d.receiverId !== this.rin) throw new EtaApiError(403, { code: 'Forbidden', message: 'Only the receiver can reject a document.' }, 'Only the receiver can reject.');
    if (d.status !== 'Valid' || d.rejectRequestDate || !this.windowOpen(d)) throw new EtaApiError(400, { code: 'OperationPeriodOver', message: 'Rejection is no longer possible for this document.' }, 'Cannot reject this document.');
    d.rejectRequestDate = new Date().toISOString(); d.status = 'Rejected';
    await this.put('sim_doc', uuid, { ...d, reason });
  }

  async declineCancellation(uuid: string) {
    const d = await this.mustOwnOrReceive(uuid);
    if (d.receiverId !== this.rin || !d.cancelRequestDate) throw new EtaApiError(400, { code: 'NoPendingRequest', message: 'No cancellation to decline.' }, 'No cancellation to decline.');
    d.cancelRequestDate = null; d.declined = 'cancellation'; d.status = 'Valid';
    await this.put('sim_doc', uuid, d);
  }

  async declineRejection(uuid: string) {
    const d = await this.mustOwnOrReceive(uuid);
    if (d.issuerId !== this.rin || d.status !== 'Rejected') throw new EtaApiError(400, { code: 'NoPendingRequest', message: 'No rejection to decline.' }, 'No rejection to decline.');
    d.status = 'Valid'; d.rejectRequestDate = null; d.declined = 'rejection';
    await this.put('sim_doc', uuid, d);
  }

  /** Accept the counterparty's pending cancellation (used by the receiver's "Accept" action). */
  async acceptCancellation(uuid: string) {
    const d = await this.mustOwnOrReceive(uuid);
    if (d.receiverId !== this.rin || !d.cancelRequestDate) throw new EtaApiError(400, { code: 'NoPendingRequest', message: 'No cancellation to accept.' }, 'No cancellation to accept.');
    d.cancelRequestDate = null;
    await this.put('sim_doc', uuid, d);
  }

  async searchDocuments(q: { direction?: 'Sent' | 'Received'; continuationToken?: string; pageSize?: number }) {
    const rows = await this.db.query<{ data: SimDoc }>(`SELECT data FROM platform WHERE kind = 'sim_doc' AND (data->>'${q.direction === 'Received' ? 'receiverId' : 'issuerId'}') = $1 ORDER BY updated_at DESC LIMIT $2`, [this.rin, q.pageSize ?? 100]);
    const result: EtaSearchResult[] = rows.map(({ data: d }) => ({ uuid: d.uuid, longId: d.longId, internalId: d.internalId, typeName: d.typeName, status: d.status, issuerId: d.issuerId, issuerName: d.issuerName, receiverId: d.receiverId, receiverName: d.receiverName, dateTimeIssued: d.dateTimeIssued, total: d.total }));
    return { result };
  }

  /** Full JSON of a document as ETA stored it (used to import received documents). */
  async getDocumentRaw(uuid: string): Promise<EtaDocument | undefined> {
    await this.mustOwnOrReceive(uuid);
    return this.get<EtaDocument>('sim_doc_body', uuid);
  }

  async createEgsCodeUsage(items: CodeUsageRequest[]) {
    const passedItems: { itemCode: string }[] = [], failedItems: { itemCode: string; errors: string[] }[] = [];
    for (const it of items) {
      if (!it.itemCode.startsWith(`EG-${this.rin}-`)) { failedItems.push({ itemCode: it.itemCode, errors: [`EGS codes must start with EG-${this.rin}-`] }); continue; }
      if (!it.codeNameAr?.trim()) { failedItems.push({ itemCode: it.itemCode, errors: ['Arabic code name is required.'] }); continue; }
      await this.put('sim_code', `${this.rin}:${it.itemCode}`, { status: 'Submitted', requestedAt: Date.now(), name: it.codeName });
      passedItems.push({ itemCode: it.itemCode });
    }
    return { passedItems, failedItems };
  }

  async getMyCodeUsageRequests() {
    const rows = await this.db.query<{ id: string; data: { status: string; requestedAt: number; name: string } }>("SELECT id, data FROM platform WHERE kind = 'sim_code' AND id LIKE $1", [`${this.rin}:%`]);
    const out: { itemCode: string; status: 'Submitted' | 'Approved' | 'Rejected'; statusReason?: string }[] = [];
    for (const r of rows) {
      const itemCode = r.id.slice(this.rin.length + 1);
      let status = r.data.status as 'Submitted' | 'Approved' | 'Rejected';
      // Simulated review: approved a minute after the request, unless the code is marked as a migration placeholder.
      if (status === 'Submitted' && Date.now() - r.data.requestedAt > CODE_REVIEW_MS) {
        status = /MIG/i.test(itemCode) ? 'Rejected' : 'Approved';
        await this.put('sim_code', r.id, { ...r.data, status });
      }
      out.push({ itemCode, status, statusReason: status === 'Rejected' ? 'GPC classification does not match the description.' : undefined });
    }
    return out;
  }

  async getCodeDetails(codeType: 'EGS' | 'GS1', itemCode: string) {
    if (codeType === 'GS1') return { itemCode, codeName: 'GS1 item', active: /^\d{8,14}$/.test(itemCode) };
    const reg = await this.get<{ status: string; name: string }>('sim_code', `${this.rin}:${itemCode}`);
    return { itemCode, codeName: reg?.name ?? '', active: reg?.status === 'Approved' };
  }

  async requestCodeReuse(items: { codetype: 'EGS' | 'GS1'; itemCode: string; comment: string }[]) {
    for (const it of items) await this.put('sim_code', `${this.rin}:${it.itemCode}`, { status: 'Submitted', requestedAt: Date.now(), name: it.comment });
  }

  /** Seeding helper: register codes as already approved for a taxpayer. */
  static async registerApprovedCodes(db: Db, rin: string, codes: { itemCode: string; status: 'Approved' | 'Submitted' | 'Rejected'; name: string }[]) {
    for (const c of codes) await db.query('INSERT INTO platform (kind, id, data) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', ['sim_code', `${rin}:${c.itemCode}`, JSON.stringify({ status: c.status, requestedAt: c.status === 'Submitted' ? Date.now() : 0, name: c.name })]);
  }
}
