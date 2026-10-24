# Fatura v2 — review handover

**Status: PARTIAL.** The implemented local workflows pass, while real ETA pre-production, signing hardware and cloud persistence remain unverified or unconfigured. The original Fatura branch and its deployed production site were not changed.

## Two separate systems

| System | Location | Local address | Data and account boundary |
|---|---|---|---|
| Fatura v2 | repository root | `http://127.0.0.1:8788/` when started with `PORT=8788` | Existing Fatura API, taxpayer accounts and DB; review with a separate `PGLITE_DIR`. |
| Meridian M&A Diligence System | [Separate Sandbox-2 system](https://github.com/gendaiski/Sandbox-2/tree/codex/native-landings-20261023/systems/meridian-ma-diligence) | `http://127.0.0.1:8797/` when started separately | Own Hono server, PGlite/Postgres database, first-run owner account, session cookie and encryption key. No Fatura route, user or DB dependency. |
| Upstream due-diligence presentation | Meridian's `public/presentation.html` | `http://127.0.0.1:8797/presentation.html` when started | Original interactive 23-slide source page and its two referenced images, with Apache-2.0 licence/notice. |

These addresses are local to the computer running each server. The cloud test instance's localhost is **not** an address on the user's Windows computer. Vercel built a [Fatura v2 branch preview](https://fatura-einvoice-git-codex-fattura-egypt-v2-gendaiski.vercel.app), but unauthenticated HTTP requests redirect to Vercel sign-in; its application behaviour and persistence on that host remain **NOT VERIFIED**. Meridian has no public deployment. For local review on Windows, clone/checkout the Fatura review branch and separately clone/checkout [Sandbox-2's Meridian branch](https://github.com/gendaiski/Sandbox-2/tree/codex/native-landings-20261023/systems/meridian-ma-diligence). Run `npm ci` and start each app in its own terminal. Follow the [M&A start guide](https://github.com/gendaiski/Sandbox-2/blob/codex/native-landings-20261023/systems/meridian-ma-diligence/README.md); no Docker is required.

## What changed

- Fatura: production ETA submission is off by default. Operator enablement (`ETA_PRODUCTION_SUBMISSION_ENABLED=true`) and request-level confirmation are both required; recurring automation does not bypass them. Simulator and pre-production paths remain available. The USB signer and ETA HTTP client are the existing integrated components; no unrelated .NET runtime or source was added.
- Fatura frontend: the public home and taxpayer dashboard have redesigned entry sections with clearer actions, source-data status and responsive layout. The simulator invoice and browser demo are labelled explicitly; mobile recent documents show their status and total without sideways scrolling. The theme icon remains visible in the mobile website header.
- Fatura composer: section navigator and clickable pre-flight issues now lead users through the invoice form. The mobile Save/Submit bar is fixed to the viewport after removing a page animation that displaced it below the form.
- Meridian: independent authenticated deal rooms, team access, encrypted files, source-linked findings, audit history and JSON report. The browser UI has desktop/mobile layouts and a light/dark toggle.
- Presentation: upstream HTML was copied exactly; SHA-256 `a26305156a9f6c6d4206fa62f23e8fd685d09aa603b7a9c203a6905fd89b9179`. The live site could not be reached to compare current typography or all pages.

## Verification evidence (2026-10-24)

| Check | Result | Evidence |
|---|---|---|
| Fatura typecheck, unit/API suite and production guard | PASS | `npm run typecheck`, `npm test`: 42/42 tests. Guard checks server flag and per-request confirmation without a live ETA call. |
| Fatura server and browser build | PASS | `npm run build:server`; `VITE_DATA=api npx vite build`. |
| Fatura full browser regression | PASS | Fresh PGlite at `/tmp/fattura-v2-final-smoke`, `BASE_URL=http://127.0.0.1:8789 ... node e2e/smoke.mjs`: invoice Valid, reload persistence, connection check, API key, signer token, signup/onboarding, admin, rejected bad password; script printed `PASSED`. |
| Fatura v2 frontend | PASS locally | Chromium checked landing CTA visibility, simulator disclosure, mobile theme toggle, dashboard demo status, Arabic RTL, mobile document cards, horizontal overflow and page errors. Screenshots below show actual local renders. |
| Fatura composer design | PASS locally | Chromium at 1440×900 and 390×844 checked five section links, validation-issue navigation, zero horizontal overflow, no page errors, and a visible mobile action bar; Arabic dark mode retained RTL layout and readable controls. |
| Meridian install and persistent integration workflow | PASS | Separate `npm ci`; `npm test`: first owner, deal, encrypted upload/download, quote/review, report, viewer grant/revoke, origin check, unsafe MIME check and restart persistence. |
| Meridian desktop/mobile UI | PASS | Chromium browser completed first-run owner setup, deal creation, file upload, cited finding, review and JSON report download. Desktop 1440 px and mobile 390 px rendered without page errors; mobile had no horizontal body overflow after correction. |
| Source presentation | PASS for repository source copy | `GET /presentation.html` and both images returned 200; Chromium rendered 23 slides without page errors. Desktop and mobile inspected. |
| Current official ETA SDK and real pre-production submission | NOT VERIFIED | Official site/services returned proxy HTTP 403; no authorised ERP credential or signing token is configured. |
| Exact match to current live presentation site | NOT VERIFIED | The live host returned proxy HTTP 403. The upstream repository version, not the current live host, was the accessible source. |
| Fatura branch preview | PARTIAL | Vercel status check passed and branch preview URL was issued; anonymous request redirects to Vercel login, so browser flow and data persistence there were not verified. |
| Meridian public deployment and real-data persistence | NOT VERIFIED | No durable Postgres, HTTPS host, or public app URL has been configured. The existing Fatura Vercel deployment must not be used for confidential files with temporary PGlite. |

Browser evidence lives in [Meridian's own handover](https://github.com/gendaiski/Sandbox-2/blob/codex/native-landings-20261023/systems/meridian-ma-diligence/docs/HANDOVER.md). These are screenshots of actual local browser renders; the screenshots are not substitutes for running the system.

Fatura frontend evidence: [landing light](v2-frontend-evidence/landing-light.png), [landing mobile dark](v2-frontend-evidence/landing-mobile-dark.png), [dashboard light](v2-frontend-evidence/dashboard-light.png), [dashboard mobile Arabic dark](v2-frontend-evidence/dashboard-mobile-ar-dark.png), [mobile document cards](v2-frontend-evidence/dashboard-mobile-documents-ar-dark.png), [composer desktop](v2-frontend-evidence/composer-desktop.png), [composer mobile](v2-frontend-evidence/composer-mobile.png), and [composer mobile Arabic dark](v2-frontend-evidence/composer-mobile-ar-dark.png). These are local demo renders; the Vercel branch preview requires sign-in and has not been browser verified.

## Required before real data or production ETA

1. Deploy Meridian behind HTTPS with a persistent Postgres service or persistent local volume, strong `MA_SESSION_SECRET`, stable `MA_ENCRYPTION_KEY`, and `MA_SETUP_TOKEN`; configure backups and access policy. Run the main workflow again at the actual address.
2. Configure a durable `DATABASE_URL` for any Fatura v2 hosted test and set the Fatura encryption/session secrets. Keep `ETA_PRODUCTION_SUBMISSION_ENABLED=false` until authorised live operations are intended.
3. Check the current [ETA SDK](https://sdk.invoicing.eta.gov.eg/) from a permitted network and test on ETA pre-production with authorised credentials and a compatible signing device. Confirm canonical bytes, signatures, field validation and response statuses. Production invoice submission remains off unless explicitly enabled.
4. Compare the preserved presentation against the live [reference](https://zoharbabin.com/due-diligence-agents/marketing/presentation.html) when accessible. The source deck itself is usable locally; mobile layout remains the upstream deck's own design, including vertical scrolling within slides.

AI due diligence agents, legal skill execution, PDF/DOCX extraction, and production ETA integration with hardware are outside the verified scope. The [source audit](V2-SOURCE-AUDIT.md) records why and the exact upstream revisions.
