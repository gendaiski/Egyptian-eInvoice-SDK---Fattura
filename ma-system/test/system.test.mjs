import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import test from 'node:test';

const randomPort = () => new Promise((resolve, reject) => {
  const server = createServer();
  server.on('error', reject);
  server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('standalone setup, real deal workflow, access isolation, and restart persistence', { timeout: 90_000 }, async () => {
  const data = await mkdtemp(join(tmpdir(), 'ma-system-test-'));
  const port = await randomPort();
  const base = `http://127.0.0.1:${port}`;
  let server;
  const start = async () => {
    server = spawn(process.execPath, ['server.mjs'], { cwd: join(import.meta.dirname, '..'), env: { ...process.env, MA_PORT: String(port), MA_HOST: '127.0.0.1', MA_DATA_DIR: data, MA_DATABASE_URL: '', NODE_ENV: 'test' }, stdio: 'ignore' });
    const until = Date.now() + 25_000;
    while (Date.now() < until) {
      try { if ((await fetch(`${base}/api/health`)).ok) return; } catch { /* starting */ }
      if (server.exitCode !== null) throw new Error(`MA server exited ${server.exitCode}`);
      await delay(100);
    }
    throw new Error('MA server did not become healthy');
  };
  const stop = async () => { if (server && server.exitCode === null) { server.kill('SIGTERM'); await once(server, 'exit'); } };
  const call = async (path, method = 'GET', body, cookie = '') => {
    const response = await fetch(`${base}/api${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const type = response.headers.get('content-type') || '';
    return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0] || '', body: type.includes('json') ? await response.json() : await response.text(), response };
  };
  try {
    await start();
    assert.equal((await call('/bootstrap')).body.setupRequired, true);
    const setup = await call('/setup', 'POST', { name: 'Owner One', email: 'owner@example.test', password: 'valid-owner-password' });
    assert.equal(setup.status, 201);
    const owner = setup.cookie;
    assert.equal((await call('/setup', 'POST', { name: 'Owner Two', email: 'other@example.test', password: 'valid-owner-password' })).status, 409);
    assert.equal((await call('/deals')).status, 401);
    const created = await call('/deals', 'POST', { name: 'Project River', target: 'Delta Holdings' }, owner);
    assert.equal(created.status, 201);
    const deal = created.body.id;
    assert.equal((await call('/deals', 'POST', { name: 'Foreign', target: 'Foreign' }, owner)).status, 201);
    const badOrigin = await fetch(`${base}/api/deals`, { method: 'POST', headers: { Cookie: owner, Origin: 'https://untrusted.example', 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'No', target: 'No' }) });
    assert.equal(badOrigin.status, 403);
    const content = 'Change of control requires lender consent.';
    const upload = await call(`/deals/${deal}/documents`, 'POST', { filename: 'terms.txt', mimeType: 'text/plain', contentBase64: Buffer.from(content).toString('base64') }, owner);
    assert.equal(upload.status, 201);
    const fileId = upload.body.id;
    assert.equal((await call(`/deals/${deal}/documents`, 'POST', { filename: 'active.html', mimeType: 'text/html', contentBase64: 'PGg+' }, owner)).status, 422);
    const finding = await call(`/deals/${deal}/findings`, 'POST', { title: 'Consent required', domain: 'Legal', severity: 'P1', origin: 'manual', summary: 'The acquisition could require lender consent.', documentId: fileId, sourceQuote: content }, owner);
    assert.equal(finding.status, 201);
    assert.equal(finding.body.quote_matched, true);
    assert.equal((await call(`/deals/${deal}/findings/${finding.body.id}/review`, 'POST', {}, owner)).status, 200);
    const unmatched = await call(`/deals/${deal}/findings`, 'POST', { title: 'Unsupported statement', domain: 'Legal', severity: 'P2', origin: 'ai-assisted', summary: 'This does not match the attached document.', documentId: fileId, sourceQuote: 'not in document' }, owner);
    assert.equal(unmatched.body.quote_matched, false);
    assert.equal((await call(`/deals/${deal}/findings/${unmatched.body.id}/review`, 'POST', {}, owner)).status, 422);
    const report = await call(`/deals/${deal}/report`, 'GET', undefined, owner);
    assert.equal(report.body.documents[0].checksum, upload.body.checksum);
    assert.equal(report.body.findings[0].review_status, 'team-reviewed');
    const member = await call('/users', 'POST', { name: 'Read Only', email: 'viewer@example.test', password: 'viewer-password-2026', role: 'viewer' }, owner);
    assert.equal(member.status, 201);
    const viewerLogin = await call('/login', 'POST', { email: 'viewer@example.test', password: 'viewer-password-2026' });
    const viewer = viewerLogin.cookie;
    assert.equal((await call(`/deals/${deal}`, 'GET', undefined, viewer)).status, 404);
    assert.equal((await call(`/deals/${deal}/access`, 'POST', { userId: member.body.id, canWrite: true }, owner)).status, 422);
    assert.equal((await call(`/deals/${deal}/access`, 'POST', { userId: member.body.id, canWrite: false }, owner)).status, 200);
    assert.equal((await call(`/deals/${deal}`, 'GET', undefined, viewer)).status, 200);
    assert.equal((await call(`/deals/${deal}/documents`, 'POST', { filename: 'new.txt', mimeType: 'text/plain', contentBase64: 'WA==' }, viewer)).status, 404);
    assert.equal((await call(`/deals/${deal}/documents/${fileId}/download`, 'GET', undefined, viewer)).body, content);
    assert.equal((await call(`/deals/${deal}/access/${member.body.id}`, 'DELETE', undefined, owner)).status, 200);
    assert.equal((await call(`/deals/${deal}`, 'GET', undefined, viewer)).status, 404);
    assert.ok((await call(`/deals/${deal}/activity`, 'GET', undefined, owner)).body.some((event) => event.action === 'access.revoke'));
    await stop();
    await start();
    assert.equal((await call('/bootstrap', 'GET', undefined, owner)).body.user.email, 'owner@example.test');
    assert.equal((await call(`/deals/${deal}/documents/${fileId}/download`, 'GET', undefined, owner)).body, content);
  } finally { await stop(); await rm(data, { recursive: true, force: true }); }
});
