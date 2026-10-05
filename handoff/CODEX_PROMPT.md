# Codex kick-off prompt

Paste everything inside the fence into Codex (cloud task or CLI) with the repository
`gendaiski/Egyptian-eInvoice-SDK---Fattura`, branch `claude/fatura-frontend`, selected.

```text
You are taking over Fatura, an Egyptian ETA (Egyptian Tax Authority) e-invoicing SaaS, as its lead full-stack engineer.

REPOSITORY
- GitHub: https://github.com/gendaiski/Egyptian-eInvoice-SDK---Fattura
- Branch: claude/fatura-frontend (default and only branch; all prior work is here)
- If you are not already in the repo:
    git clone https://github.com/gendaiski/Egyptian-eInvoice-SDK---Fattura.git
    cd Egyptian-eInvoice-SDK---Fattura && git checkout claude/fatura-frontend
- A full source snapshot is also committed at handoff/fatura-source.zip (identical to the branch at handoff;
  use the branch, not the zip, as your working copy).

READ FIRST, IN THIS ORDER
1. AGENTS.md — commands, invariants, conventions. Follow it strictly.
2. docs/HANDOFF.md — what exists, what is verified, known issues, prioritized backlog (section 4), architecture, file map.
3. docs/API.md — integration API, webhooks, signer protocol.
4. docs/ETA-SDK-MAPPING.md — how ETA rules map to code, and the list of points to verify against the live SDK.
Skim docs/UX-FLOWS.md and docs/DESIGN-SYSTEM.md before any UI work.

STACK
React 18 + TypeScript (strict) + Vite 5 + Tailwind 3 front end (bilingual EN/AR with RTL);
Hono API on Node 22 with Postgres 16 (or embedded PGlite when DATABASE_URL is unset); zod validation;
jose JWT sessions; pkijs/asn1js CAdES-BES signing; vitest. Deploys to Vercel via the Build Output API
(scripts/build-vercel.mjs) or as one Docker container (Dockerfile, docker-compose.yml).

STEP 0 — ESTABLISH A GREEN BASELINE BEFORE CHANGING ANYTHING
  npm ci
  npm run typecheck          # must be clean
  npm test                   # expect 41 passed
  npm run build:server && VITE_DATA=api npx vite build
  PGLITE_DIR=memory npm start &          # http://localhost:8787, seeds demo data
  BASE_URL=http://localhost:8787 node e2e/smoke.mjs   # 12 browser checks; install Playwright + Chromium if missing
Report the results. If anything fails, fix that first and explain the root cause.
Test logins (seeded): demo@fatura.eg / fatura-demo-2026 (taxpayer owner), admin@fatura.eg / fatura-admin-2026 (platform admin).

THEN WORK THROUGH THE BACKLOG IN docs/HANDOFF.md SECTION 4, IN PRIORITY ORDER
P0
 1. Persistent database for the Vercel deployment: document the exact steps to attach Neon/Postgres
    (DATABASE_URL for production + preview). You cannot change Vercel settings yourself — write the steps in
    docs/DEPLOY.md and make sure the app works with DATABASE_URL (it already does locally; keep it that way).
 2. Add a GitHub Actions CI workflow (.github/workflows/ci.yml): npm ci, typecheck, test, build:server,
    VITE_DATA=api vite build, start the server with PGLITE_DIR=memory, run e2e/smoke.mjs with Playwright Chromium.
 3. Fix tenant self-service billing change: add POST /api/v1/actions/billing/change (Owner only, zod-validated,
    audit-logged), call it from BillingSection in src/pages/app/Settings.tsx instead of mutating db.admin.tenants,
    add an API test.
P1
 4. Email: a Mailer interface with an SMTP implementation and a dev implementation that logs; deliver through an
    outbox like server/src/services/webhooks.ts. Use it for: invoice to customer on Valid when settings.autoEmail,
    team invitations, password reset, installment due/overdue reminders. New env vars go in .env.example.
 5. Password reset by email, and TOTP two-factor sign-in (users.mfa column exists). Bilingual UI.
 6. Team invitation acceptance flow (token, accept page, set password).
 7. Replace the remaining simulated buttons with real server actions (search src/pages for "setTimeout(r,"):
    data export archive (ZIP of submitted JSON + PDFs), signer test signature, admin reference-data sync,
    admin ETA-health retry.
Stop after P1 and summarise; ask before starting P2 (payment gateway, POS e-receipts, signer packaging).

RULES
- Respect every invariant in AGENTS.md (one ETA document per sale; ETA maths only in src/eta with tests;
  all document state changes through server/src/services/documents.ts; tenant isolation by session tenant;
  secrets never sent to the browser; bilingual L('en','ar') strings; design-system components only).
- Schema changes are new entries appended to MIGRATIONS in server/src/db/migrations.ts; SQL must run on Postgres 16 and PGlite.
- Every new endpoint gets a test in server/test/; integrator-facing ones are documented in docs/API.md.
- Keep commits small and focused, one backlog item per commit (or per PR), imperative subject, body explains why.
- Before each commit: npm run typecheck && npm test. Before finishing an item that touches UI ↔ API, run e2e/smoke.mjs.
- Never commit secrets, .env files, build output (dist*, .vercel) or real credentials.
- Do not change ETA endpoint paths, tax rules or document fields based on guesses: the live SDK
  (https://sdk.invoicing.eta.gov.eg) is the source of truth; if you cannot reach it, leave the code as is and add the
  question to "To verify against the live SDK" in docs/ETA-SDK-MAPPING.md.
- Update docs/HANDOFF.md (status table and backlog) as you complete items, so the next engineer has the true state.

DELIVERABLES FOR EACH ITEM
Code + tests + docs, green typecheck/tests/smoke, and a short note: what changed, how you verified it,
anything left open.
```
