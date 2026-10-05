import type { DocumentTypeInfo, EtaDocument, EtaError, EtaStatus, SubmissionResponse, ValidationStep } from '../../../src/eta/types';
import { env } from '../env';
import { EtaApiError, type CodeUsageRequest, type EtaApi, type EtaCredentials, type EtaDocumentDetails, type EtaEnv, type EtaSearchResult } from './types';

export const ETA_HOSTS: Record<Exclude<EtaEnv, 'simulator'>, { id: string; api: string }> = {
  preprod: { id: 'https://id.preprod.eta.gov.eg', api: 'https://api.preprod.invoicing.eta.gov.eg' },
  production: { id: 'https://id.eta.gov.eg', api: 'https://api.invoicing.eta.gov.eg' },
};

export interface TokenStore {
  get(): Promise<{ token: string; expiresAt: number } | null>;
  set(token: string, expiresAt: number): Promise<void>;
}

const memoryTokens = (): TokenStore => { let v: { token: string; expiresAt: number } | null = null; return { get: async () => v, set: async (token, expiresAt) => { v = { token, expiresAt }; } }; };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * ETA eInvoicing API over HTTPS.
 * - OAuth2 client credentials, token cached until 5 minutes before expiry; a 401 forces one re-login.
 * - 429 / 5xx / network errors retry with exponential backoff (honours Retry-After), up to `maxRetries`.
 * - Bodies are UTF-8 JSON with non-ASCII left unescaped: ETA hashes the bytes it receives.
 */
export class HttpEtaClient implements EtaApi {
  private idUrl: string;
  private apiUrl: string;
  constructor(public readonly env: Exclude<EtaEnv, 'simulator'>, private creds: EtaCredentials, private tokens: TokenStore = memoryTokens(), private opts: { maxRetries?: number; fetch?: typeof fetch; baseDelayMs?: number } = {}) {
    this.idUrl = env === 'preprod' || env === 'production' ? ETA_HOSTS[env].id : '';
    this.apiUrl = ETA_HOSTS[env].api;
    if (envOverride().id) this.idUrl = envOverride().id!;
    if (envOverride().api) this.apiUrl = envOverride().api!;
  }

  private get fetch() { return this.opts.fetch ?? fetch; }

  async login() {
    const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: this.creds.clientId, client_secret: this.creds.clientSecret, scope: 'InvoicingAPI' });
    const res = await this.fetch(`${this.idUrl}/connect/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body });
    if (!res.ok) throw new EtaApiError(res.status, undefined, res.status === 400 || res.status === 401 ? 'ETA rejected the client ID or secret.' : `ETA identity service returned ${res.status}.`, res.status >= 500);
    const j = (await res.json()) as { access_token: string; expires_in: number };
    await this.tokens.set(j.access_token, Date.now() + (j.expires_in - 300) * 1000);
    return { accessToken: j.access_token, expiresIn: j.expires_in };
  }

  private async token(force = false) {
    const t = force ? null : await this.tokens.get();
    if (t && t.expiresAt > Date.now()) return t.token;
    return (await this.login()).accessToken;
  }

  /** Core request with auth, retries and ETA error mapping. */
  async request<T>(method: string, path: string, body?: unknown, accept: 'json' | 'bytes' = 'json'): Promise<T> {
    const maxRetries = this.opts.maxRetries ?? 3;
    let reauthed = false;
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        res = await this.fetch(`${this.apiUrl}${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${await this.token()}`,
            Accept: accept === 'json' ? 'application/json' : 'application/pdf',
            'Accept-Language': 'en',
            ...(body !== undefined ? { 'Content-Type': 'application/json; charset=utf-8' } : {}),
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
      } catch (e) {
        if (attempt < maxRetries) { await sleep(this.backoff(attempt)); continue; }
        throw new EtaApiError(0, undefined, `Could not reach ETA: ${(e as Error).message}`, true);
      }
      if (res.status === 401 && !reauthed) { reauthed = true; await this.token(true); attempt--; continue; }
      if ((res.status === 429 || res.status >= 500) && attempt < maxRetries) {
        const ra = Number(res.headers.get('retry-after'));
        await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra * 1000, 30_000) : this.backoff(attempt));
        continue;
      }
      if (!res.ok) {
        let err: EtaError | undefined;
        try { const j = (await res.json()) as { error?: EtaError } & EtaError; err = j.error ?? (j.code ? j : undefined); } catch { /* non-JSON error */ }
        throw new EtaApiError(res.status, err, err?.message ?? `ETA returned ${res.status} for ${method} ${path}.`, res.status === 429 || res.status >= 500);
      }
      if (accept === 'bytes') return new Uint8Array(await res.arrayBuffer()) as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }
  }

  private backoff(attempt: number) { const base = this.opts.baseDelayMs ?? 500; return base * 2 ** attempt + Math.random() * base; }

  async getDocumentTypes() {
    const j = await this.request<{ result: { id: number; name: string; description: string; documentTypeVersions?: { name: string; status: string }[]; workflowParameters?: { parameter: string; value: number }[] }[] }>('GET', '/api/v1.0/documenttypes');
    return j.result.map((t): DocumentTypeInfo => {
      const wp = Object.fromEntries((t.workflowParameters ?? []).map((p) => [p.parameter, p.value]));
      const hours = (k: string) => Number(wp[k] ?? 168);
      return {
        id: t.id, name: t.name, description: t.description, code: (t.name?.[0]?.toUpperCase() ?? 'I') as DocumentTypeInfo['code'],
        activeVersion: t.documentTypeVersions?.find((v) => v.status === 'Active')?.name ?? '1.0',
        workflowParameters: { cancellationWindowHours: hours('document-cancellation'), rejectionWindowHours: hours('document-rejection'), declineCancellationWindowHours: hours('document-cancellation-decline'), declineRejectionWindowHours: hours('document-rejection-decline') },
      };
    });
  }

  submitDocuments(documents: EtaDocument[]) { return this.request<SubmissionResponse>('POST', '/api/v1/documentsubmissions', { documents }); }

  async getSubmission(submissionId: string) {
    const j = await this.request<{ overallStatus: string; documentSummary: { uuid: string; internalId: string; status: EtaStatus }[] }>('GET', `/api/v1.0/documentSubmissions/${encodeURIComponent(submissionId)}?PageNo=1&PageSize=100`);
    return { overallStatus: j.overallStatus, documents: j.documentSummary ?? [] };
  }

  async getDocumentDetails(uuid: string): Promise<EtaDocumentDetails> {
    const j = await this.request<{ uuid: string; longId?: string; internalId?: string; submissionUUID?: string; status: EtaStatus; validationResults?: { validationSteps?: ValidationStep[] }; cancelRequestDate?: string | null; rejectRequestDate?: string | null }>('GET', `/api/v1.0/documents/${encodeURIComponent(uuid)}/details`);
    return { uuid: j.uuid, longId: j.longId, internalId: j.internalId, submissionUUID: j.submissionUUID, status: j.status, validationSteps: j.validationResults?.validationSteps ?? [], cancelRequestDate: j.cancelRequestDate, rejectRequestDate: j.rejectRequestDate };
  }

  async getDocumentRaw(uuid: string) {
    const j = await this.request<{ document?: string } & Partial<EtaDocument>>('GET', `/api/v1.0/documents/${encodeURIComponent(uuid)}/raw`);
    if (typeof j.document === 'string') { try { return JSON.parse(j.document) as EtaDocument; } catch { return undefined; } }
    return j as EtaDocument;
  }

  getDocumentPdf(uuid: string) { return this.request<Uint8Array>('GET', `/api/v1.0/documents/${encodeURIComponent(uuid)}/pdf`, undefined, 'bytes'); }

  async cancelDocument(uuid: string, reason: string) { await this.request('PUT', `/api/v1.0/documents/state/${encodeURIComponent(uuid)}/state`, { status: 'cancelled', reason }); }
  async rejectDocument(uuid: string, reason: string) { await this.request('PUT', `/api/v1.0/documents/state/${encodeURIComponent(uuid)}/state`, { status: 'rejected', reason }); }
  async declineCancellation(uuid: string) { await this.request('PUT', `/api/v1.0/documents/state/${encodeURIComponent(uuid)}/decline/cancelation`); }
  async declineRejection(uuid: string) { await this.request('PUT', `/api/v1.0/documents/state/${encodeURIComponent(uuid)}/decline/rejection`); }

  async searchDocuments(q: { direction?: 'Sent' | 'Received'; submissionDateFrom?: string; submissionDateTo?: string; continuationToken?: string; pageSize?: number }) {
    const p = new URLSearchParams();
    Object.entries(q).forEach(([k, v]) => v !== undefined && p.set(k, String(v)));
    const j = await this.request<{ result: EtaSearchResult[]; metadata?: { continuationToken?: string } }>('GET', `/api/v1.0/documents/search?${p}`);
    return { result: j.result ?? [], continuationToken: j.metadata?.continuationToken };
  }

  createEgsCodeUsage(items: CodeUsageRequest[]) { return this.request<{ passedItems: { itemCode: string }[]; failedItems: { itemCode: string; errors: string[] }[] }>('POST', '/api/v1.0/codetypes/requests/codes', { items }); }

  async getMyCodeUsageRequests() {
    const j = await this.request<{ result: { itemCode: string; status: 'Submitted' | 'Approved' | 'Rejected'; statusReason?: string }[] }>('GET', '/api/v1.0/codetypes/requests/my?Ps=100&Pn=1');
    return j.result ?? [];
  }

  getCodeDetails(codeType: 'EGS' | 'GS1', itemCode: string) { return this.request<{ itemCode: string; codeName: string; active: boolean }>('GET', `/api/v1.0/codetypes/${codeType}/codes/${encodeURIComponent(itemCode)}`); }
  async requestCodeReuse(items: { codetype: 'EGS' | 'GS1'; itemCode: string; comment: string }[]) { await this.request('PUT', '/api/v1.0/codetypes/requests/codeusages', { items }); }
}

function envOverride() { return { id: env().ETA_ID_URL, api: env().ETA_API_URL }; }
