# Fatura · فاتورة

Egyptian e-invoicing SaaS built on the Egyptian Tax Authority (ETA) eInvoicing SDK.
This repository contains the **complete front end**: the public website (15 pages), the taxpayer
workspace, the Fatura platform admin panel, sign-in and onboarding — one app sharing one design system. A deterministic mock of the ETA
API stands in for the backend, so every flow can be run without credentials.

- Bilingual **English / Arabic** with full RTL, light and dark themes, responsive down to 360 px.
- Three ways to get paid: **one payment**, **recurring**, and **installments**. ETA always
  receives a single valid tax document. The plan drives Fatura's receivables and scheduling.
- ETA tax maths (T1–T20), canonical serialization for signing, and pre-flight validation are
  implemented as tested, framework-free modules in `src/eta/` that the backend can reuse.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for tax maths, serialization, validation, schedules
npm run build      # typecheck + production build
npm run build:preview  # single-file live preview (dist-preview/fatura.html)
```

Demo entry points: `/` (marketing + pricing), `/signin`, `/signup` → `/onboarding`,
`/app` (taxpayer workspace), `/admin` (platform admin). Settings → Data → *Reset demo data*
restores the sample company. State persists in `localStorage` for the demo only.

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
  ARCHITECTURE.md      the production backend this front end expects
```

## How the website connects to the system
- **Pricing → sign-up → tenant.** Plans and prices are read from the admin panel's plan list. "Start with X"
  carries the plan and billing model into sign-up, which creates a trial tenant (visible in Admin → Tenants),
  records a lead, and sets the workspace's Settings → Plan & billing.
- **Contact → Admin → Leads.** Demo, sales and partnership requests land in the leads inbox with status tracking.
- **Admin → Platform & website → announcement** controls the bar on every public page.
- **Status page** reads the same ETA traffic and error data as Admin → ETA integration health.

## Status and caveats

- The front end is complete. The backend is specified in `docs/ARCHITECTURE.md` but not built yet.
  `src/eta/client.ts` is the contract to implement server-side.
- `sdk.invoicing.eta.gov.eg` was not reachable from the build environment. The spec here was
  assembled from the SDK's published structure and needs confirming against the live SDK.
  Items to verify are listed at the end of `docs/ETA-SDK-MAPPING.md`.
- Fatura is independent software and is not affiliated with the Egyptian Tax Authority.
