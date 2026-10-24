# Meridian · M&A Diligence System

An **independent** application for confidential deal rooms, document evidence, findings, team access and audit history. It does not use Fatura routes, accounts, database, branding, server process or encryption keys. It is built beside Fatura in this repository so the two review versions can be inspected together.

## Start locally

Requires Node.js 22 or newer. From this directory:

```bash
npm ci
npm start
```

Open **http://127.0.0.1:8797/** on the same computer. On first visit, create the owner account in the page; no terminal code is needed for local-only access. The database and a stable, private encryption key are created in `ma-system/data/`. Keep this directory backed up. Stop with `Ctrl+C` and restart with `npm start`; the owner account and encrypted files survive the restart. To use another local port or storage path, set `MA_PORT` or `MA_DATA_DIR` before launch.

The application binds to `127.0.0.1` by default. It cannot be reached directly from another computer unless you configure a secure reverse proxy or authorised tunnel. Do not use a temporary server for real confidential deal data.

## What works

- First-run owner setup, sign-in and server-side sessions.
- Owner/admin created members (admin, analyst, viewer), explicit per-deal grants and revocation. Owners/admins can see every room; viewers cannot write.
- Deal creation, encrypted uploads and authorised downloads of PDF, TXT, Markdown, CSV and DOCX files up to 8 MB. Files are AES-256-GCM encrypted in the database; downloads are forced attachments.
- Manual or reviewer-supplied AI-assisted findings with domain, priority, source document, quote and location. Exact text quotes are matched to stored text, but this is **not** a correctness judgment. Reviewers can mark a finding team reviewed; unmatched cited quotes are blocked from review.
- JSON evidence report, timestamped audit history, responsive light and dark UI.
- Original upstream interactive 23-slide presentation at `/presentation.html`, copied with its two referenced images and Apache-2.0 licence notice. [Source and comparison limits](../docs/V2-SOURCE-AUDIT.md).

AI agents, PDF/DOCX text extraction, legal conclusions, invitation emails, password reset, SSO and externally hosted services are **not included**. File contents are encrypted; deal names, file names, finding metadata, and audit records remain readable to the database administrator. A matched text quote proves only that the text exists. An `ai-assisted` label describes user-supplied work, not an agent execution.

## Remote deployment

For a persistent remote container, provide:

| Variable | Purpose |
|---|---|
| `MA_HOST=0.0.0.0` | Listen behind an authenticated HTTPS reverse proxy. |
| `MA_DATABASE_URL` | Durable Postgres database URL. Without it, local PGlite uses `MA_DATA_DIR` and needs a persistent volume. Never use ephemeral storage. |
| `MA_SESSION_SECRET` | Private random string of at least 32 characters, required with Postgres or `NODE_ENV=production`. |
| `MA_ENCRYPTION_KEY` | Private random 32-byte key encoded in base64, required with Postgres or `NODE_ENV=production`. Preserve it; losing it makes documents unreadable. |
| `MA_SETUP_TOKEN` | Private token required for the first owner account when binding beyond localhost. Enter it only into the setup page. |
| `MA_PORT` | Optional listen port, default `8797`. |

The app has no TLS termination or managed backup service. Put it behind HTTPS and restrict access before any real documents. Never include these values in Git, reports or screenshots. Running on Vercel functions without persistent Postgres is blocked by the server. A sample Dockerfile is provided for an operator who already has a persistent database and HTTPS host; this branch does not deploy it to Fatura's production service.

## API

The browser uses an authenticated `/api` service. `GET /api/bootstrap` reports setup and session state. `POST /api/setup`, `POST /api/login`, and `POST /api/logout` manage accounts. Owners/admins use `GET/POST /api/users`, `GET /api/activity`, `GET/POST /api/deals`, and `GET/POST/DELETE /api/deals/:id/access`. Authorised room members use `GET/POST /api/deals/:id/documents`, `GET /api/deals/:id/documents/:documentId/download`, `GET/POST /api/deals/:id/findings`, `POST /api/deals/:id/findings/:findingId/review`, `GET /api/deals/:id/activity`, and `GET /api/deals/:id/report`. Browser requests use same-origin HttpOnly cookies; cross-origin mutations are rejected. All write fields are validated on the server.

## Verify

`npm test` starts a separate server on a temporary database, creates an owner, deal and encrypted document, matches/reviews a finding, checks the report, grants and revokes a viewer, rejects unsafe input, restarts the server, and confirms the session and encrypted file still work. The browser UI was separately exercised in desktop and mobile Chromium. Verification specifics are in [v2 handover](../docs/V2-HANDOVER.md).

Source attribution for the presentation: [zoharbabin/due-diligence-agents](https://github.com/zoharbabin/due-diligence-agents/tree/6950efd), Apache-2.0; copied licence and notice are in [`public/`](public/).
