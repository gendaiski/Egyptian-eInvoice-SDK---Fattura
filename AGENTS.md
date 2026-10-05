# AGENTS.md — working rules for coding agents (Codex, Claude Code, others)

Fatura is an Egyptian ETA e-invoicing SaaS: React front end + Hono/Node API on Postgres + a USB-token
signer agent. Read `docs/HANDOFF.md` first; it describes what exists, what is verified and what is next.

## Commands

```bash
npm ci                                   # Node 20+ (developed on Node 22)
npm run typecheck                        # tsc -b --noEmit — must be clean
npm test                                 # vitest: 41 tests (src/**/*.test.ts, server/test/**/*.test.ts)
npm run build:server && VITE_DATA=api npx vite build && npm start   # full stack on :8787, embedded DB
npm run dev:server  +  VITE_DATA=api npm run dev                    # dev: API :8787, Vite :5173 (proxies /api)
BASE_URL=http://localhost:8787 node e2e/smoke.mjs                   # browser smoke test (needs Playwright)
npm run build:vercel                     # Vercel Build Output API → .vercel/output
npm run build:preview                    # browser-only demo, single file (dist-preview/)
```

Before you commit: `npm run typecheck && npm test` must pass. For changes touching the UI ↔ API flow,
also run the smoke test against a fresh database (delete `.data/` or set `PGLITE_DIR=memory`).

## Layout

- `src/` — front end. `src/eta/` holds ETA domain logic (types, tax calc, canonical serialization,
  validation, code tables) shared by the server. `src/store/` is the client store (local demo mode and API mode).
- `server/src/` — API. `routes/` (core: auth + data sync; actions: workflow; ext: integration API; signer protocol
  inside actions.ts), `services/` (documents pipeline, webhooks outbox, worker tick), `eta/` (HTTP client +
  simulator), `signing/` (CAdES-BES), `db/` (client, migrations, seed), `repo.ts` (data access).
- `signer-agent/` — Fatura Signer (PKCS#11 USB token or .p12) that long-polls the server for signing jobs.
- `docs/` — HANDOFF, API, ARCHITECTURE, ETA-SDK-MAPPING, UX-FLOWS, DESIGN-SYSTEM.

## Invariants — do not break

1. **ETA always receives one tax document per sale.** Recurring and installment plans are Fatura-side
   receivables; never split a sale into several ETA documents.
2. **Tax maths and canonical serialization live in `src/eta/` only** and are covered by tests. Change them only with
   test cases that cite the ETA rule. The server imports them; do not fork copies.
3. **Every document state change goes through `server/src/services/documents.ts`** so `doc.events` (the audit trail),
   notifications and webhooks stay complete.
4. **Tenant isolation:** every query on tenant data filters by `tenant_id` from the session/API key/agent token,
   never from the request body.
5. **Secrets never reach the browser.** ETA client secrets and signing keys are AES-256-GCM encrypted
   (`server/src/crypto`). API keys, agent tokens and webhook secrets are shown once and stored hashed.
6. **The front end mirrors the server's data shape** (`src/store/model.ts` `DB`). The bootstrap payload
   (`server/src/routes/bootstrap.ts`) must stay assignable to it; `npm run typecheck` covers both.
7. **Bilingual UI:** every user-facing string uses `L('English', 'العربية')`; layouts must work in RTL.
8. **Design system:** use components in `src/components/ui.tsx` and Tailwind tokens (`tailwind.config.js`,
   `src/styles/index.css`). No new colour literals; see `docs/DESIGN-SYSTEM.md`.

## Conventions

- TypeScript strict, ES modules, 2-space indent, single quotes, match surrounding density (short components,
  few comments that explain *why*).
- Server input is validated with zod (`server/src/routes/validators.ts`); errors are `HttpError(status, code, message)`.
- Database changes: append a new migration in `server/src/db/migrations.ts` (never edit applied ones); SQL must run
  on both Postgres 16 and PGlite.
- New API endpoints: add a test in `server/test/api.test.ts` and document integrator-facing ones in `docs/API.md`.
- Never commit secrets, `.env`, build output, or the Vercel env values. `.env.example` lists the variables.
- Commit messages: imperative subject line, body explains why.
