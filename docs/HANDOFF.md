# Fatura — engineering handoff

*Handoff date: 5 October 2026. Read this, then `AGENTS.md`, before changing code.*

## 1. Where everything is

| What | Where |
|---|---|
| GitHub repository | https://github.com/gendaiski/Egyptian-eInvoice-SDK---Fattura |
| Working branch (default, only branch) | `claude/fatura-frontend` |
| Clone | `git clone https://github.com/gendaiski/Egyptian-eInvoice-SDK---Fattura.git && cd Egyptian-eInvoice-SDK---Fattura && git checkout claude/fatura-frontend` |
| Full source snapshot | `handoff/fatura-source.zip` in the repo (a `git archive` of the handoff commit; identical to the branch) |
| Codex kick-off prompt | `handoff/CODEX_PROMPT.md` |
| Test deployment (Vercel) | https://fatura-einvoice.vercel.app — project `fatura-einvoice` (`prj_bYGbeDTbSSQHvMZ92KRnQ87ii0vj`), team `gendaiski`; redeploys on every push to the branch |
| Browser-only demo (no server) | built with `npm run build:preview`; a hosted copy exists as a Claude artifact owned by the project owner |
| Integration API reference | `docs/API.md` |
| ETA rules → code map | `docs/ETA-SDK-MAPPING.md` (section "To verify against the live SDK" lists open questions) |
| UX journeys | `docs/UX-FLOWS.md` · Design system: `docs/DESIGN-SYSTEM.md` (live at `/design-system`) |

### Test logins (seeded when `SEED_DEMO=true` on an empty database)

| Email | Password | Role |
|---|---|---|
| `demo@fatura.eg` | `fatura-demo-2026` | Owner of the demo taxpayer (Lawtech Labs Egypt, ~100 documents, ETA simulator, test certificate) |
| `admin@fatura.eg` | `fatura-admin-2026` | Fatura platform staff, *Super admin* (admin panel) |

These are demo credentials and are printed on the sign-in page (turn that off with `VITE_SHOW_DEMO_LOGINS=false`).
Production secrets (`APP_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET`) live only in the Vercel project's
environment variables — they are not in the repository and must not be.

## 2. What the product is

Fatura lets an Egyptian company issue e-invoices, credit/debit notes and export invoices to the Egyptian Tax
Authority (ETA) e-invoicing system, get paid by **one payment, recurring schedules or installments**, and handle
purchase documents suppliers issue to it. It is multi-tenant SaaS with a platform admin panel and a public website.

Three audiences:
1. **Taxpayer users** — `/app`: dashboard, invoices & notes, composer, document detail, recurring, receivables &
   installments, customers, items & EGS/GS1 codes, received documents, submissions log, e-receipts (UI), tax reports,
   settings (company, branches, ETA connection, signing, team & roles, API & webhooks, numbering, plan & billing, data).
2. **Fatura staff** — `/admin`: leads, tenants (+ detail, plan change, suspend), plans & pricing, billing & dunning,
   ETA integration health, reference data, audit log, staff, platform settings / website banner.
3. **Integrators** — REST integration API with API keys, idempotent document creation and signed webhooks.

Plus the public website (15 pages: home, product, payments, e-receipts, solutions, pricing, developers, ETA guide,
security, status, about, contact, terms, privacy, design system), sign-up and a 4-step onboarding.
Everything is bilingual English/Arabic with RTL, light/dark themes, responsive to 360 px.

## 3. Status — what is built and verified

| Area | State | Evidence |
|---|---|---|
| Front end (website, app, admin, auth, onboarding) | Complete, wired to the API | typecheck clean; `e2e/smoke.mjs` |
| API server (Hono, Node) | Complete for the flows below | `server/test/api.test.ts` (12 tests) |
| Database | Postgres 16 via `DATABASE_URL`, or embedded PGlite | smoke test passed on both |
| Document pipeline: draft → sign → submit → poll → Valid/Invalid | Done | API tests + smoke test (Valid in ~2 s on the simulator) |
| Cancel / reject / decline cancellation / decline rejection / accept cancellation | Done, window-checked | API tests |
| Received documents inbox (cross-tenant routing on the simulator by RIN) | Done | API test |
| Payment plans: one-time, recurring (worker runs schedules), installments (schedule + payments) | Done | `src/billing/schedules.test.ts`, API tests |
| Pre-flight validation (blocks bad documents before ETA) | Done | `src/eta/validate.test.ts`, API test |
| ETA HTTP client (OAuth2 client-credentials, token cache in DB, 401 re-login, 429/5xx back-off with Retry-After, UTF-8 Arabic bodies) | Done against a mock ETA | `server/test/eta-http.test.ts` (7 tests) — **not yet run against real ETA pre-production** |
| ETA simulator (validation, signature verification, statuses, received routing) | Done | used by default for new tenants |
| CAdES-BES signing (detached CMS, signingCertificateV2) | Done | `server/test/cades.test.ts` |
| Signing modes: server-held test certificate; USB token via Fatura Signer agent (long-poll jobs) | Done | API test "USB-token signer agent protocol"; agent tested with a .p12 |
| Integration API (`/api/v1/ext`), API keys, idempotency by `internal_id` | Done | API tests + smoke test |
| Webhooks (transactional outbox, HMAC-SHA256, retries) | Done | API tests |
| Worker tick (recurring runs, ETA polling, code requests, received sync, webhooks) | Done | runs every 60 s on Node; daily cron on Vercel Hobby |
| Auth: email + password (scrypt), JWT session cookie, roles (Owner/Admin/Accountant/Sales/Viewer), staff roles (Super admin/Finance/Support) | Done | API tests |
| Vercel deployment | Deployed, build READY | Live URL not verifiable from the build environment (egress blocked) — please smoke-test it |
| Docker / docker-compose | Written | not run in the build environment (no Docker daemon there) |

Test totals: `npm test` → **41 passed** (7 files). `e2e/smoke.mjs` → **12 checks passed** on PGlite and on Postgres 16.

## 4. Known issues and gaps (start here)

Ordered by priority. Each item names where to work and what "done" means.

### P0 — needed before anyone else tests on the live URL
1. **Persistent database on Vercel.** No `DATABASE_URL` is set, so each serverless instance uses its own temporary
   PGlite in `/tmp`: data resets on cold start and can differ between instances.
   *Do:* provision Postgres (Neon via the Vercel Marketplace is simplest), set `DATABASE_URL` for production and
   preview, redeploy. Migrations and seeding run automatically on first request (`server/src/db/client.ts`).
   *Done when:* a sign-up survives a redeploy.
2. **Verify the live deployment.** Run `BASE_URL=https://fatura-einvoice.vercel.app node e2e/smoke.mjs`.
   If Vercel Authentication blocks the URL, disable it for production in Project → Settings → Deployment Protection.
3. **Tenant self-service billing change fails in API mode.** Settings → Plan & billing → *Confirm* mutates
   `db.admin.tenants`, which syncs to `PUT /api/v1/data/admin.tenants/:id`; that route requires a staff role, so a
   tenant owner gets 403. *Do:* add `POST /api/v1/actions/billing/change` (Owner only; validates plan & model; audit log)
   and call it from `BillingSection` in `src/pages/app/Settings.tsx`. Add an API test.

### P1 — needed to go live with real customers
4. **ETA pre-production run.** With real ERP credentials (ETA portal → taxpayer profile → ERP), switch a tenant to
   pre-production, submit invoices, credit notes, an export invoice; confirm field-level rules and the open questions
   in `docs/ETA-SDK-MAPPING.md` → "To verify against the live SDK". Fix `server/src/eta/http.ts` / `src/eta/*` as needed,
   with tests.
5. **Email delivery.** Nothing sends email yet. Needed for: invoice to customer on Valid (`settings.autoEmail`),
   team invitations, password reset, installment reminders, dunning. Add a mailer service (SMTP or a provider) behind an
   interface, queue through the outbox pattern used by webhooks.
6. **Password reset and second factor.** API mode has email + password only (the browser demo shows an OTP step that is
   not enforced server-side; `users.mfa` column exists). Add reset-by-email and TOTP or email OTP.
7. **Team invitations.** Inviting creates a member record with status `invited`; there is no acceptance flow. Add an
   invite token, accept page, and email.
8. **Payments for Fatura's own subscriptions.** Plans, billing models (monthly, yearly, installments, one-time licence),
   platform invoices and dunning are modelled and shown in admin, but card/wallet collection is not integrated. Typical
   Egyptian options: Paymob, Fawry, InstaPay/bank transfer reconciliation. Optionally payment links on customer invoices.
9. **USB signer packaging.** `signer-agent/agent.ts` works (Node + optional `pkcs11js`). Package it for Windows
   (installer, run as service/tray, auto-update) and test with real Egypt Trust / MCDR / Fixed Misr tokens.

### P2 — completeness and hardening
10. **E-receipts (POS, receipt v1.2).** UI and seed exist; server submission to `/api/v1/receiptsubmissions` with POS
    authentication is not implemented.
11. **Simulated buttons that still need a server action:** Settings → Signing *Test signature* and *Download agent*;
    Settings → Data *Request archive* (export ZIP of JSON + PDFs); Admin → Reference data *Sync* (pull ETA code tables);
    Admin → ETA health *Retry*. Search for `setTimeout(r,` in `src/pages`.
12. **ETA printout.** `GET /api/v1/actions/documents/:id/eta-pdf` exists; the UI prints its own PDF. Offer both.
13. **Worker cadence on Vercel.** Hobby allows a daily cron only; on Pro set `crons` in `scripts/build-vercel.mjs` to
    every 5 minutes, or use an external scheduler calling `POST /api/cron/tick` with `Authorization: Bearer $CRON_SECRET`.
14. **Observability.** Add structured logging, error tracking (e.g. Sentry) and request IDs.
15. **CI** (do this early; the Codex prompt schedules it in P0). Add a GitHub Actions workflow: `npm ci`, `npm run typecheck`, `npm test`, build, and the smoke test
    against a PGlite server.
16. **Rate limiting** exists for login only; extend to sign-up, contact form and the integration API.
17. **Arabic copy review** by a native speaker, and an accessibility audit (keyboard, screen reader, contrast).

## 5. Architecture

```
Browser SPA (React) ──/api/v1 (cookie)──►  Hono API  ──► Postgres (or PGlite)
ERP / scripts ───────/api/v1/ext (Bearer fat_live_…)─►      │
Fatura Signer (USB) ─/api/v1/signer (Agent fat_agent_…)─►   ├─ services/documents  sign → submit → poll
                                                            ├─ signing/            CAdES-BES, test certs, jobs
                                                            ├─ eta/http            real ETA (preprod / production)
                                                            ├─ eta/simulator       in-process ETA
                                                            ├─ services/webhooks   outbox → HMAC POSTs
                                                            └─ services/worker     tick: recurring, poll, codes, inbox, webhooks
```

- **Hosting shapes.** `server/node.ts` serves API + built SPA + worker in one process (Docker, VM, Render, Fly…).
  `server/vercel.ts` + `scripts/build-vercel.mjs` produce a Vercel Build Output: static SPA, one Node function for
  `/api/*`, PGlite copied next to it, cron for the worker.
- **Data model.** Tables (`server/src/db/migrations.ts`): `users, tenants, memberships, tenant_config, records,
  documents, signing_jobs, agents, api_keys, webhooks, outbox, platform, audit, eta_tokens` (+ `schema_migrations`).
  Entities are stored as JSONB in `data`, mirroring `src/store/model.ts`, with filter/unique fields promoted to columns.
  `records` holds tenant collections (customers, items, recurring, members, notices); `platform` holds staff-side
  collections (plans, leads, refs, site settings, platform invoices).
- **Front-end data flow (API mode).** `GET /api/v1/bootstrap` returns the whole `DB` snapshot for the session (tenant
  data + public platform data; staff get admin data). Edits are optimistic: `src/store/sync.ts` diffs collections and
  sends `PUT/DELETE /api/v1/data/:collection/:id` (singletons debounced via `PUT /data/singleton/:name`). Workflow
  steps use `POST /api/v1/actions/...`. While documents are Signing/Submitted the client refreshes every 4 s.
  Server errors surface as toasts (`fatura:error` event).
- **Front-end modes.** `VITE_DATA=api` → server. Otherwise → local demo with `src/eta/mockClient.ts` and
  `localStorage`. `VITE_ROUTER=memory` builds the single-file preview.
- **ETA environments per tenant.** `simulator` (default for sign-ups), `preprod`, `production`; host overrides via
  `ETA_ID_URL` / `ETA_API_URL`. Client secret stored encrypted; tokens cached in `eta_tokens`.
- **Signing.** `test-certificate`: server generates a self-signed cert + key (encrypted) — simulator/preprod only.
  `usb-token`: documents queue as `signing_jobs`; the paired agent long-polls, signs the canonical string with PKCS#11,
  returns CAdES; the server verifies then submits. `hsm` / `cloud` are UI options only (not implemented).
- **Security.** scrypt passwords; HS256 JWT in an HTTP-only SameSite=Lax cookie; AES-256-GCM for secrets
  (`APP_ENCRYPTION_KEY`); SHA-256 hashes for API keys / agent tokens; secure headers; optional CORS allow-list;
  role checks in `server/src/auth/session.ts` (`requireTenant`, `requireStaff`).

## 6. Configuration

All variables are listed with explanations in `.env.example`. Server: `DATABASE_URL`, `PGLITE_DIR`, `APP_SECRET`,
`APP_ENCRYPTION_KEY`, `CRON_SECRET`, `SEED_DEMO`, `CORS_ORIGINS`, `PORT`, `WORKER`, `ETA_ID_URL`, `ETA_API_URL`.
Front end (build time): `VITE_DATA`, `VITE_API_URL`, `VITE_SHOW_DEMO_LOGINS`.

**Important:** changing `APP_ENCRYPTION_KEY` makes stored ETA secrets and signing keys unreadable; changing
`APP_SECRET` signs everyone out and invalidates nothing else.

## 7. How to work on it

```bash
npm ci
npm run typecheck && npm test                      # 41 tests
npm run dev:server                                 # API on :8787 (tsx watch), embedded DB in .data/
VITE_DATA=api npm run dev                          # SPA on :5173, /api proxied to :8787
# full stack like production
npm run build:server && VITE_DATA=api npx vite build && npm start
BASE_URL=http://localhost:8787 node e2e/smoke.mjs  # 12 browser checks; needs Playwright + Chromium
docker compose up --build                          # app + Postgres 16
```

Reset local data: stop the server and delete `.data/`. Tests use an in-memory database (`server/test/helpers.ts`).

## 8. File map (most-touched files)

| File | Purpose |
|---|---|
| `src/store/model.ts` | Domain types (`DB`, `Doc`, `Customer`, `Item`, `Recurring`, …) and derived helpers |
| `src/store/store.tsx` | Store provider (local vs API), `useActions`, `useAuth` |
| `src/store/sync.ts` | Diff-sync of client edits to the API |
| `src/eta/calc.ts · serialize.ts · validate.ts · codes.ts` | ETA tax maths, canonical string, pre-flight rules, code tables |
| `src/billing/schedules.ts` | Due dates, recurring runs, installment schedules |
| `src/pages/app/Composer.tsx` | Invoice/note composer (payment plan, lines, taxes, validation) |
| `src/pages/app/Settings.tsx`, `SettingsApi.tsx` | Settings; server-only panels (signer pairing, API keys, webhooks) |
| `server/src/app.ts` | App assembly, error mapping, health, cron |
| `server/src/routes/core.ts` | Auth, sign-up, contact, data sync (tenant + admin collections) |
| `server/src/routes/actions.ts` | Workflow actions + signer agent protocol |
| `server/src/routes/ext.ts` | Integration API |
| `server/src/routes/bootstrap.ts` | Session snapshot for the SPA |
| `server/src/services/documents.ts` | Save, submit, sign, poll, state changes, payments, recurring, codes, inbox |
| `server/src/eta/http.ts · simulator.ts · index.ts` | ETA client, simulator, per-tenant factory |
| `server/src/signing/*` | CAdES-BES, test certificates, signing jobs |
| `server/src/db/*` | Connection, migrations, seed |
| `signer-agent/agent.ts` | USB-token signer |

## 9. Definition of done for any change

- `npm run typecheck` clean and `npm test` green; new behaviour has tests.
- UI changes work in English and Arabic (RTL), light and dark, at 360 px and desktop.
- Flows touching the API pass `e2e/smoke.mjs` against a fresh database.
- Integrator-visible changes are documented in `docs/API.md`; schema changes are new migrations.
- No secrets committed; `.env.example` updated for new variables.
