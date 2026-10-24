# Fattura Beta: full-stack development and acceptance plan

This branch starts from `codex/fattura-egypt-v2`; the v1 deployment and v2 review branch remain separate. [V1/V2 comparison](V1-V2-COMPARISON.md) identifies the inherited features and gaps. Beta work must preserve the rule that each sale produces one ETA tax document and that tenant document changes pass through the document service.

| Version | Frontend | Backend | Admin | Readiness |
|---|---|---|---|---|
| V1 | Website, taxpayer app, admin screens | API, ETA simulator, signing and persistence foundation | Dashboard and partially wired controls | Local prototype; live ETA and payment collection unverified |
| V2 | Improved website/dashboard/composer and clearer simulator labels | Added production ETA submission guard | Inherited V1 controls | Local simulator tested; hosted review protected |
| Beta branch | Operations screen, billing request/test flow, honest disabled states, exports | Payment intents, staff operations, simulator retry, scoped exports, audited settlement | Server-backed status, billing evidence and approval | Local full-stack candidate; external integrations still gated |

## What can be tested now

| Area | Beta implementation | Acceptance evidence |
|---|---|---|
| Web, taxpayer and admin frontends | Existing React/Vite bilingual pages plus a new Admin → Beta operations screen. | Browser smoke test on a fresh local database; both light and dark themes should be reviewed. |
| API and persistence | Existing Hono API and Postgres/PGlite data model. Operations screen reads counts and queue state from SQL. | API tests for staff-only status and count response. Local PGlite data survives restarts when `PGLITE_DIR` is a directory. |
| ETA simulator | Existing document/signing workflow. Staff can retry submitted **simulator** documents for a selected tenant. Live ETA environments are blocked by this control. | API tests for tenant scope and simulator retry; full browser invoice workflow. |
| Billing administration | Staff can record independently confirmed bank/cash/provider payment evidence with a reference. Duplicate settlement is rejected and the action is audited. | API test for invalid reference, successful record, repeated payment and exported audit entry. This does **not** collect money. |
| Payment test harness | A provider-neutral intent table tracks amount in piasters, tenant, invoice, provider and outcome. The Fatura simulator can test failed and paid outcomes without moving money; Paymob and Fawry are visible but disabled. | API test for tenant isolation, duplicate intent reuse, failure/retry, settlement and no second settlement. `PAYMENT_SIMULATOR_ENABLED=true` is required. |
| Tenant billing changes | Owner requests a billing model, which remains pending until Finance/Super admin approves it. | API test for request, role guard, persisted pending state, and approval. Actual proration and next-cycle scheduling remain open. |
| Exports | Staff audit JSON export and tenant-owned JSON data archive. | API tests check auth, scope and omission of stored ETA secrets. PDF bundle is not included. |
| Reference tables | Bundled ETA SDK code tables remain available for composing invoices. Sync button is disabled until a verified ETA source connector exists. | Existing code-table tests; live sync **NOT VERIFIED**. |

## Release gates before a hosted Beta

1. **Storage and secrets.** Provision a persistent Postgres database for the hosting project, set `DATABASE_URL`, `APP_SECRET`, `APP_ENCRYPTION_KEY`, and `CRON_SECRET` in host secrets, turn demo seeding/login hints off, run schema migrations, restart, and verify an invoice survives a redeploy. The current Vercel PGlite fallback is temporary and must not hold customer invoices.
2. **ETA test environment.** Obtain authorized taxpayer ERP credentials and a supported signing certificate/token. Compare validation, CAdES, polling, cancellation, received documents and code tables against current ETA preproduction documentation. Capture sanitized request/response evidence. Keep `ETA_PRODUCTION_SUBMISSION_ENABLED=false` until a separate production authorization and signoff.
3. **Payments.** Paymob and Fawry are the requested provider choices. Their current official sandbox API contracts were inaccessible from this workspace, so no live adapter is claimed. Obtain and verify their documentation and sandbox credentials, then add separate adapters for hosted checkout, signed callback verification, idempotent settlement, reconciliation, refunds and failure cases. Confirm bank transfer and manually recorded payments are visibly distinct from provider-collected payments. Never test a live charge without authorization.
4. **Admin operations.** Add a durable background-job lease and retry history for serverless hosting; use a scheduler at an appropriate interval. Connect reminder delivery, live reference-table sync, staff invitations and MFA. Eliminate remaining informational controls or label them unavailable.
5. **Security and support.** Add account recovery, invitation acceptance, second factor, rate limiting appropriate to the host, data-retention policy, backup/restore test, operational logs and per-role admin browser tests. Keep secrets out of exports and logs.
6. **Accounting and compliance.** Review generated platform invoices, tax treatment, payment allocation, e-receipts, document PDF printout and retention requirements with an Egyptian tax professional. Do not infer compliance from simulator success.
7. **Final acceptance.** Run typecheck, unit/API tests, browser smoke, role/isolation tests, responsive Arabic and English review, and hosted tests on the exact deployment. Record PASS/FAIL/NOT VERIFIED for each gate.

## Local Beta review

On a computer with Node 20+, run `npm ci` once and then `npm run beta:local`. The command builds the API and browser app, starts them at `http://127.0.0.1:8787/`, uses a persistent local `.data/beta-secure` database and a separate ignored local secrets file, enables the test payment simulator and keeps real ETA production submission disabled. Keep the database and `.data/beta-local-secrets.json` together when backing up or moving this local Beta; losing the encryption key makes stored integration secrets unreadable. It does not require Docker. Press Ctrl+C to stop. On Windows PowerShell the same two commands work. If port 8787 is busy, run `$env:FATURA_BETA_PORT=8858` before `npm run beta:local` and open the printed URL.

To run the pieces separately:

```bash
npm ci
npm run typecheck && npm test
npm run build:server
VITE_DATA=api VITE_SHOW_DEMO_LOGINS=true npx vite build
PGLITE_DIR=.data/beta PAYMENT_SIMULATOR_ENABLED=true PORT=8787 npm start
```

Open `http://127.0.0.1:8787/`, sign in with the local seeded demo accounts described in [HANDOFF.md](HANDOFF.md), then open Admin → Beta operations. Use a **fresh local database only** for demo credentials. Keep `WORKER=off` while manually inspecting a database snapshot; the normal Node server runs the worker once a minute. The status screen identifies which counts come from the server. The ETA health charts are illustrative seeded data and do not prove real ETA uptime.

The seeded taxpayer has an open invoice `FAT-TEST-0001` so Settings → Plan & billing can test both failed and paid simulator outcomes. It is demo data, never a collectible invoice.

Local verification on 2026-10-24: `npm run typecheck` PASS; `npm test` PASS (47 checks); `npm run beta:local` served the health endpoint and landing page; full-stack `e2e/smoke.mjs` PASS against a fresh PGlite database; browser test of failed then paid simulator outcome PASS after reload; tenant JSON and staff audit downloads PASS; the new operations screen rendered in [light](beta-evidence/beta-operations-light.png) and [dark](beta-evidence/beta-operations-dark.png) with no browser page errors. [Taxpayer billing screenshot](beta-evidence/beta-billing.png). These are local results, not proof of hosted persistence or a real provider transaction.

The local server is on the machine running the command. A cloud workspace's `localhost` is not the user's Windows computer. Do not publish a local Beta with the seeded demo accounts.

## Beta decision record

| Decision | Reason |
|---|---|
| Keep v1 and v2 branches unchanged. | Allows independent comparison and rollback of review work. |
| Separate simulator retry from live ETA. | Admin testing must not silently send invoices to the authority. |
| Require evidence for manual settlement. | A status toggle cannot demonstrate that funds were collected. |
| Disable unconnected integrations in the UI. | A success toast must correspond to a real backend result. |
| Keep hosted and external integration gates open. | Credentials, hosting configuration, live ETA acceptance and a payment provider have not yet been verified. |

**Current readiness:** local full-stack Beta candidate. Hosted Beta, real ETA, provider payment collection and production admin security are **PARTIAL / NOT VERIFIED** until the gates above pass.
