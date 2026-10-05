/**
 * End-to-end smoke test of the full stack in a real browser.
 *   npm run build:server && VITE_DATA=api npx vite build && npm start   (fresh DB, SEED_DEMO=true)
 *   BASE_URL=http://localhost:8787 node e2e/smoke.mjs
 * Needs Playwright with Chromium: `npm i --no-save playwright && npx playwright install chromium`
 * (or set PLAYWRIGHT_MODULE to an existing install). Screenshots go to e2e/out/.
 */
import { mkdirSync } from 'node:fs';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const B = (process.env.BASE_URL ?? 'http://localhost:8787').replace(/\/$/, '');
const out = 'e2e/out';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errs = [];
const step = (s) => console.log('•', s);
const fails = [];
const check = (label, ok, detail = '') => { console.log(ok ? '✓' : '✗', label, detail); if (!ok) fails.push(label); };
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
  page.on('response', (r) => { if (r.url().includes('/api/') && r.status() >= 400) errs.push(`${r.status()} ${r.request().method()} ${r.url()}`); });
  return page;
}
// 1. Tenant owner signs in, creates and submits an invoice, sees it go Valid.
let page = await newPage();
await page.goto(`${B}/signin`, { waitUntil: 'networkidle' });
await page.getByLabel('Work email').fill('demo@fatura.eg');
await page.getByLabel('Password').fill('fatura-demo-2026');
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForURL('**/app', { timeout: 15000 });
step('demo login → ' + page.url());
await page.goto(`${B}/app/documents/new`, { waitUntil: 'networkidle' });
await page.getByLabel('Bill to').selectOption({ index: 1 });
await page.getByLabel('Item 1').selectOption({ index: 1 });
await page.getByLabel('Qty').fill('3');
await page.getByRole('button', { name: /^Submit$|Sign & submit/ }).first().click();
await page.waitForURL((u) => /\/app\/documents\/(?!new)[^/]+$/.test(u.pathname), { timeout: 15000 });
const docUrl = page.url();
step('submitted → ' + docUrl);
const t0 = Date.now();
let status = '';
while (Date.now() - t0 < 40000) {
  await page.waitForTimeout(2000);
  status = (await page.locator('main h1').first().locator('xpath=..').innerText()).match(/\b(Valid|Invalid|Submitted|Signing|Draft)\b/)?.[1] ?? '?';
  if (status === 'Valid' || status === 'Invalid') break;
}
check('invoice reaches Valid', status === 'Valid', `(${status} after ${Math.round((Date.now() - t0) / 1000)}s)`);
await page.screenshot({ path: `${out}/1-doc.png`, fullPage: true });
// persistence: reload shows the doc
await page.reload({ waitUntil: 'networkidle' });
check('document persists after reload', /Valid/.test(await page.locator('main').innerText()));
// settings: integration test & api keys
await page.goto(`${B}/app/settings/integration`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Test connection' }).click();
await page.waitForTimeout(1500);
check('ETA connection test', (await page.getByText(/Token issued/).count()) > 0);
await page.goto(`${B}/app/settings/developers`, { waitUntil: 'networkidle' });
await page.getByLabel('Key name').fill('E2E ERP');
await page.getByRole('button', { name: 'Create key' }).click();
await page.waitForTimeout(1500);
const key = (await page.locator('[role=dialog]').innerText()).match(/fat_live_[\w-]+/)?.[0];
check('API key issued', !!key);
await page.screenshot({ path: `${out}/2-devs.png`, fullPage: true });
if (key) {
  const r = await fetch(`${B}/api/v1/ext/documents?limit=2`, { headers: { Authorization: `Bearer ${key}` } });
  check('integration API accepts the key', r.status === 200, `(${r.status})`);
}
await page.goto(`${B}/app/settings/signing`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Pair a signer' }).click();
await page.getByRole('button', { name: 'Create token' }).click();
await page.waitForTimeout(800);
check('signer agent token issued', /fat_agent_/.test(await page.locator('[role=dialog]').innerText()));
await page.screenshot({ path: `${out}/3-signing.png`, fullPage: true });
// 2. New signup → onboarding on simulator → dashboard
page = await newPage();
await page.goto(`${B}/signup`, { waitUntil: 'networkidle' });
const email = `e2e${Date.now()}@example.com`;
await page.getByLabel('Your name').fill('Test Owner');
await page.getByLabel('Company legal name').fill('E2E Trading LLC');
await page.getByLabel('Work email').fill(email);
await page.getByLabel('Password').fill('correct-horse-9');
await page.locator('input[type=checkbox]').check();
await page.getByRole('button', { name: 'Create account' }).click();
await page.waitForURL('**/onboarding', { timeout: 15000 });
step('signup → onboarding');
await page.getByLabel('Tax registration number (RIN)').fill('555666777');
await page.getByRole('button', { name: 'Verify' }).click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByLabel('City / district').fill('Nasr City');
await page.getByLabel('Street').fill('Abbas El Akkad');
await page.getByLabel('Building number').fill('12');
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Test connection' }).click();
await page.waitForTimeout(2000);
check('onboarding ETA connection', (await page.getByText(/Connected\. Token issued/).count()) > 0);
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Use a test certificate for now' }).click();
await page.waitForTimeout(2000);
check('onboarding test certificate', (await page.getByText('Test certificate ready').count()) > 0);
await page.getByRole('button', { name: 'Continue' }).click();
await page.getByRole('button', { name: 'Go to dashboard' }).click();
await page.waitForURL('**/app', { timeout: 15000 });
step('onboarded → ' + page.url());
await page.screenshot({ path: `${out}/4-new-tenant.png`, fullPage: true });
// 3. Platform admin
page = await newPage();
await page.goto(`${B}/signin`, { waitUntil: 'networkidle' });
await page.getByLabel('Work email').fill('admin@fatura.eg');
await page.getByLabel('Password').fill('fatura-admin-2026');
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForURL('**/admin', { timeout: 15000 });
await page.goto(`${B}/admin/tenants`, { waitUntil: 'networkidle' });
check('admin sees the new tenant', /E2E Trading/.test(await page.locator('main').innerText()));
await page.goto(`${B}/admin/leads`, { waitUntil: 'networkidle' });
check('admin sees the sign-up lead', /E2E Trading/.test(await page.locator('main').innerText()));
await page.screenshot({ path: `${out}/5-admin.png`, fullPage: true });
// wrong password
page = await newPage();
await page.goto(`${B}/signin`, { waitUntil: 'networkidle' });
await page.getByLabel('Work email').fill('demo@fatura.eg');
await page.getByLabel('Password').fill('nope-nope');
await page.getByRole('button', { name: 'Continue' }).click();
await page.waitForTimeout(1000);
check('wrong password is rejected with a message', /incorrect/i.test(await page.locator('form').innerText()));
const unexpected = errs.filter((e) => !e.includes('401 POST') || !e.includes('/auth/login'));
const ok = !fails.length && !unexpected.length;
console.log(ok ? 'PASSED' : `FAILED\n${[...fails, ...unexpected].join('\n')}`);
await browser.close();
process.exit(ok ? 0 : 1);
