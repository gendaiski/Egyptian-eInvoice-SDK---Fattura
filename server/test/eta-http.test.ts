import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setEnv } from '../src/env';
import { HttpEtaClient } from '../src/eta/http';
import { EtaApiError } from '../src/eta/types';

/** A fake ETA that records requests and can be told to misbehave. */
const log: { path: string; auth?: string; body: string; contentType?: string }[] = [];
let logins = 0;
let failNext: { status: number; times: number; retryAfter?: string } | null = null;
let expireToken = false;
const fake = new Hono();
fake.post('/connect/token', async (c) => {
  logins++;
  const form = await c.req.parseBody();
  if (form.client_secret !== 'good-secret' || form.grant_type !== 'client_credentials' || form.scope !== 'InvoicingAPI') return c.json({ error: 'invalid_client' }, 400);
  return c.json({ access_token: `tok${logins}`, expires_in: 3600, token_type: 'Bearer' });
});
fake.use('/api/*', async (c, next) => {
  log.push({ path: c.req.path, auth: c.req.header('authorization'), body: c.req.method === 'GET' ? '' : await c.req.raw.clone().text(), contentType: c.req.header('content-type') });
  if (expireToken) { expireToken = false; return c.json({}, 401); }
  if (failNext && failNext.times > 0) { failNext.times--; return c.json({}, failNext.status as 500, failNext.retryAfter ? { 'Retry-After': failNext.retryAfter } : {}); }
  await next();
});
fake.get('/api/v1.0/documenttypes', (c) => c.json({ result: [{ id: 1, name: 'I', description: 'Invoice', documentTypeVersions: [{ name: '1.0', status: 'Active' }], workflowParameters: [{ parameter: 'document-cancellation', value: 72 }, { parameter: 'document-rejection', value: 72 }] }] }));
fake.post('/api/v1/documentsubmissions', async (c) => {
  const b = await c.req.json();
  if (!b.documents?.length) return c.json({ error: { code: 'BadStructure', message: 'documents is required', target: 'documents' } }, 400);
  return c.json({ submissionId: 'SUB1', acceptedDocuments: b.documents.map((d: { internalID: string }, i: number) => ({ uuid: `U${i}`, longId: `L${i}`, internalId: d.internalID })), rejectedDocuments: [] }, 202);
});
fake.get('/api/v1.0/documents/:uuid/details', (c) => c.json({ uuid: c.req.param('uuid'), status: 'Valid', validationResults: { status: 'Valid', validationSteps: [{ name: 'Step', status: 'Valid' }] } }));
fake.put('/api/v1.0/documents/state/:uuid/state', (c) => c.json(true));

let server: ReturnType<typeof serve>;
let client: HttpEtaClient;
beforeAll(async () => {
  server = serve({ fetch: fake.fetch, port: 0 });
  await new Promise((r) => server.once('listening', r));
  const port = (server.address() as AddressInfo).port;
  setEnv({ ETA_ID_URL: `http://127.0.0.1:${port}`, ETA_API_URL: `http://127.0.0.1:${port}` });
  client = new HttpEtaClient('preprod', { clientId: 'cid', clientSecret: 'good-secret' }, undefined, { baseDelayMs: 5 });
});
afterAll(() => { server.close(); setEnv({ ETA_ID_URL: undefined, ETA_API_URL: undefined }); });

describe('HttpEtaClient', () => {
  it('logs in once and reuses the token', async () => {
    const before = logins;
    await client.getDocumentTypes();
    await client.getDocumentTypes();
    expect(logins - before).toBe(1);
    expect(log.at(-1)!.auth).toMatch(/^Bearer tok\d+$/);
  });

  it('maps document types and their workflow windows', async () => {
    const [t] = await client.getDocumentTypes();
    expect(t.workflowParameters.cancellationWindowHours).toBe(72);
    expect(t.activeVersion).toBe('1.0');
  });

  it('sends Arabic as raw UTF-8 (not \\u escapes) in submissions', async () => {
    const res = await client.submitDocuments([{ internalID: 'INV-1', invoiceLines: [{ description: 'استشارات' }] } as never]);
    expect(res.acceptedDocuments[0].uuid).toBe('U0');
    const sent = log.find((l) => l.path === '/api/v1/documentsubmissions')!;
    expect(sent.body).toContain('استشارات');
    expect(sent.body).not.toContain('\\u');
    expect(sent.contentType).toContain('charset=utf-8');
  });

  it('re-authenticates once on 401', async () => {
    const before = logins;
    expireToken = true;
    const d = await client.getDocumentDetails('U0');
    expect(d.status).toBe('Valid');
    expect(logins - before).toBe(1);
  });

  it('retries 429 and 5xx with backoff, then succeeds', async () => {
    failNext = { status: 429, times: 2, retryAfter: '0' };
    expect((await client.getDocumentDetails('U1')).validationSteps).toHaveLength(1);
    failNext = { status: 503, times: 1 };
    await client.cancelDocument('U1', 'Wrong customer');
    expect(log.at(-1)!.body).toBe(JSON.stringify({ status: 'cancelled', reason: 'Wrong customer' }));
  });

  it('gives up after the retry budget with a retryable error', async () => {
    failNext = { status: 500, times: 10 };
    await expect(client.getDocumentDetails('U2')).rejects.toMatchObject({ status: 500, retryable: true });
    failNext = null;
  });

  it('maps ETA error bodies and bad credentials', async () => {
    await expect(client.submitDocuments([])).rejects.toBeInstanceOf(EtaApiError);
    await expect(client.submitDocuments([])).rejects.toMatchObject({ status: 400, error: { code: 'BadStructure' } });
    const bad = new HttpEtaClient('preprod', { clientId: 'cid', clientSecret: 'nope' });
    await expect(bad.login()).rejects.toThrow('ETA rejected the client ID or secret.');
  });
});
