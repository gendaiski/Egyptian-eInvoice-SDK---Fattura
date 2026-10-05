# Fatura · فاتورة

Egyptian e-invoicing SaaS built on the Egyptian Tax Authority (ETA) eInvoicing SDK.
This repository contains the **whole product**:

- **Front end** — the public website (15 pages), the taxpayer workspace, the Fatura platform admin panel,
  sign-in and onboarding, one app sharing one design system.
- **Back end** — a Node API (Hono) on Postgres: accounts and tenants, the sign → submit → poll document
  pipeline, a real ETA HTTP client, an in-process **ETA simulator**, CAdES-BES signing, a background worker,
  an **integration API** for ERPs with API keys, idempotency and signed webhooks.
- **Fatura Signer** — a small agent for the PC holding the company's USB token (PKCS#11), in `signer-agent/`.

The front end runs in two modes: against the server (`VITE_DATA=api`, the default for deployments) or as a
self-contained browser demo with a deterministic ETA mock (the live preview artifact).

- Bilingual **English / Arabic** with full RTL, light and dark themes, responsive down to 360 px.
- Three ways to get paid: **one payment**, **recurring**, and **installments**. ETA always
  receives a single valid tax document. The plan drives Fatura's receivables and scheduling.
- ETA tax maths (T1–T20), canonical serialization for signing, and pre-flight validation are
  implemented as tested, framework-free modules in `src/eta/` that the backend can reuse.

## Run it

Full stack (API + front end + worker, embedded Postgres, demo data):

```bash
npm install
npm run build:server && VITE_DATA=api npx vite build
npm run start                    # http://localhost:8787
```

Development: `npm run dev:server` (API on :8787) and `VITE_DATA=api npm run dev` (Vite on :5173 proxies /api).
With Docker and a real Postgres: `docker compose up --build`. Configuration: see `.env.example`.

| Test login | Password | Opens |
|---|---|---|
| `demo@fatura.eg` | `fatura-demo-2026` | Taxpayer workspace (demo company, ETA simulator, test certificate) |
| `admin@fatura.eg` | `fatura-admin-2026` | Fatura admin panel |

New sign-ups get their own tenant on the ETA simulator; switch to pre-production in
Settings → ETA connection once you have ETA ERP credentials.

```bash
npm test               # 41 tests: tax maths, serialization, validation, schedules, API, signing, ETA client
npm run typecheck
npm run build:preview  # single-file browser-only demo (dist-preview/fatura.html)
npm run build:vercel   # Vercel Build Output (.vercel/output)
npm run build:signer   # bundles Fatura Signer (signer-agent/dist/fatura-signer.mjs)
```

## Deploy

- **Vercel** — `vercel.json` builds `npm run build:vercel`: static SPA + one Node function for `/api` + a daily cron.
  Set `APP_SECRET`, `APP_ENCRYPTION_KEY`, `CRON_SECRET` and **`DATABASE_URL`** (Neon or any Postgres).
  Without `DATABASE_URL` each function instance uses its own temporary embedded database, which is only good
  for a quick test: data resets on cold starts and may differ between instances.
- **Any container host** — the `Dockerfile` runs API, front end and worker in one process (`PORT`, `DATABASE_URL`).

Integrators: see `docs/API.md` (REST API, webhooks, signer protocol).

**Taking over the project?** Start with `docs/HANDOFF.md` and `AGENTS.md`; `handoff/CODEX_PROMPT.md` is a ready-made kick-off prompt.

## What is in the box

| Area | Screens |
|---|---|
| Website | Home, Product, Payments (live installment and recurring calculators), E-receipts, Solutions, Pricing (plans and prices come from the admin panel; volume estimator; comparison), Developers (live ETA payload and signed string), ETA guide (with a readiness checklist), Security, Status (driven by admin ETA-health data), About, Contact (feeds Admin → Leads), Terms, Privacy, Design system |
| Auth | Sign in with 2-step code, sign up, 4-step onboarding (RIN verify → head office → ETA credentials → signer) |
| Sales | Dashboard with "needs attention" queue, invoices & notes list with bulk sign & submit, composer, document detail with lifecycle, QR, validation results, cancel window, payments |
| Payments | Recurring schedules (list, detail, pause, issue now), aged receivables, installment plan tracker, payment log |
| Purchases | Received documents inbox: reject within window, accept/decline issuer cancellations, input VAT |
| Compliance | Items & EGS/GS1 codes with code-usage requests, submissions log, POS e-receipts, monthly VAT report |
| Settings | Company, branches (branchID), ETA connection (env, client credentials, test), signing (USB token agent / HSM / cloud), team & roles, numbering, plan & billing, data export |
| Admin | Leads inbox from the website, website announcement bar, platform overview (MRR, traffic, attention list), tenants + detail (plan change, suspend, support view), plans & pricing per billing model, billing & dunning, ETA integration health, reference-data sync, audit log, staff roles, platform settings |

## Project layout

```
src/
  eta/          ETA domain: types (v1.0 JSON), code tables, calc, serialize, validate, client interface, mock
  billing/      Payment plans: due dates, recurring runs, installment schedules
  store/        Domain model, seed data, store + actions (sign → submit → poll pipeline)
  i18n/         EN/AR provider, RTL, number/date/currency formatting
  components/   UI kit, charts, invoice paper (print/PDF), QR
  layouts/      Taxpayer shell, admin shell, command palette (⌘K)
  site/         Public website: layout, page kit, pages
  pages/        app/, admin/, auth/
docs/
  DESIGN-SYSTEM.md     Nile Ledger v2: tokens, type, components, voice (live at /design-system)
  ETA-SDK-MAPPING.md   every SDK operation and rule → where it lives in the product
  UX-FLOWS.md          the core user journeys and the decisions behind them
  ARCHITECTURE.md      architecture of the production system
  API.md               integration API, webhooks, signer protocol
server/
  src/app.ts           Hono app (/api): routes/, services/ (documents, webhooks, worker)
  src/eta/             ETA HTTP client (token cache, retries) and the in-process ETA simulator
  src/signing/         CAdES-BES signer, test certificates, signing jobs
  src/db/              Postgres / PGlite client, migrations, seed
  test/                API, signing and ETA-client tests
  node.ts · vercel.ts  entry points
signer-agent/          Fatura Signer for USB tokens (PKCS#11) or .p12 files
```

## How the website connects to the system
- **Pricing → sign-up → tenant.** Plans and prices are read from the admin panel's plan list. "Start with X"
  carries the plan and billing model into sign-up, which creates a trial tenant (visible in Admin → Tenants),
  records a lead, and sets the workspace's Settings → Plan & billing.
- **Contact → Admin → Leads.** Demo, sales and partnership requests land in the leads inbox with status tracking.
- **Admin → Platform & website → announcement** controls the bar on every public page.
- **Status page** reads the same ETA traffic and error data as Admin → ETA integration health.

## Status and caveats

- Front end and back end are complete and tested end to end (browser → API → signing → ETA simulator → Valid),
  on both embedded Postgres and Postgres 16.
- Going live with ETA needs things only the taxpayer can supply: ERP client credentials from the ETA portal,
  a signing certificate on a USB token (Egypt Trust, MCDR, Fixed Misr) paired through Fatura Signer, and
  a first round of test submissions on ETA pre-production to confirm field-level rules.
- Not built: card/payment-gateway collection for Fatura's own subscriptions (billing is tracked and invoiced,
  payments are recorded manually), outbound email delivery (hook point: `autoEmail`), and POS e-receipt submission.
- `sdk.invoicing.eta.gov.eg` was not reachable from the build environment. The spec here was
  assembled from the SDK's published structure and needs confirming against the live SDK.
  Items to verify are listed at the end of `docs/ETA-SDK-MAPPING.md`.
- Fatura is independent software and is not affiliated with the Egyptian Tax Authority.
