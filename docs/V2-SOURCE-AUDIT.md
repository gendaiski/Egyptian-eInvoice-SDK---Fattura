# Fatura v2 source audit and verification boundary

This branch is a separate review version of the existing Fatura product. The [Meridian M&A Diligence System](https://github.com/gendaiski/Sandbox-2/tree/codex/native-landings-20261023/systems/meridian-ma-diligence) is a separate application in the Sandbox-2 systems repository. It has its own Hono server, browser UI, PGlite/Postgres database, accounts, encryption keys and startup. It does not share Fatura routes or credentials.

## ETA references

| Source and inspected revision | What it provides | Licence / integration decision |
|---|---|---|
| [Egypt-ETA-E-Invoice-Signer](https://github.com/AH3laly/Egypt-ETA-E-Invoice-Signer) `1f8b9a9` | .NET command-line document serializer and signer | No GitHub licence declared; old examples contain literal PINs. Inspected only; no code copied. |
| [ETAHttpSignature](https://github.com/mrkindy/ETAHttpSignature) `77eeead` | Local .NET/WebSocket bridge for signing ETA documents | MIT. The name does **not** mean ETA API HTTP authentication. Fatura already uses a separate signer agent; this source was inspected, not embedded. |
| [ASET](https://github.com/AhmedSuror/ASET) `2354a2e` | Early-stage .NET client SDK for ETA invoices | Apache-2.0. Its API wrapper is not a drop-in replacement for Fatura's TypeScript client. Inspected, no code copied. |

GitHub's latest recorded pushes at inspection were 2022-06-25 (Egypt-ETA-E-Invoice-Signer), 2024-01-09 (ETAHttpSignature) and 2025-09-13 (ASET). The first is a .NET command-line tool, the second a .NET local signing bridge, and the third a .NET SDK with configuration for ETA client credentials. All require .NET integration work and, for actual token signing, a compatible certificate/device. None supplies an authorised ETA production credential or an official compliance certification. Fatura's own TypeScript serializer, validator, signer agent and HTTP client are retained because they are already integrated and tested against the simulator.

Fatura's existing `src/eta/` code performs invoice preparation and preflight validation. `server/src/signing/` signs document data using CAdES; `signer-agent/` handles a locally connected PKCS#11 token. `server/src/eta/http.ts` uses OAuth2 client credentials and a bearer token to call ETA. A document signature, a USB-device PIN, and API authentication are three distinct concerns. This version adds a default-off operator gate (`ETA_PRODUCTION_SUBMISSION_ENABLED=true`) **and** requires confirmation for each production submission request. Queued USB signing jobs record their target ETA environment and confirmation; switching environments while one is pending blocks sending. Automated recurring submissions stay drafts in production. The gate was tested against a local database without sending a request to ETA.

The [official ETA SDK](https://sdk.invoicing.eta.gov.eg/) and the live production/SIT services returned HTTP 403 through this environment's network proxy on 2026-10-24. Current official rules, certificate hardware, real pre-production responses, and production interoperability are **NOT VERIFIED**. Existing endpoint mappings in [ETA-SDK-MAPPING.md](ETA-SDK-MAPPING.md) remain a working hypothesis until checked against current official material and authorised pre-production credentials. No live invoice was submitted.

## M&A references

| Source and inspected revision | Actual type and capability | Licence / decision |
|---|---|---|
| [due-diligence-agents](https://github.com/zoharbabin/due-diligence-agents) `6950efd` | Python CLI with 13 cross-domain agents, Claude Agent SDK, data-room reports; requires Python 3.12 and a paid model account | Apache-2.0. The complete source presentation and its two local images are copied byte-for-byte under Meridian's `public/`, with licence and notice. Agent execution is **not** integrated. |
| [claude-legal-skill](https://github.com/evolsb/claude-legal-skill) `bca0d2e` | Legal-review skill for agent hosts | MIT. Not an independent app or reliable legal conclusion; inspected, no global skill installation. |
| [awesome-private-equity](https://github.com/iamtorgo/awesome-private-equity) `4654c60` | Curated private-equity links | CC0-1.0. Reference material only. |
| [deal-room-api](https://github.com/mmmihaeel/deal-room-api) `3b49a11` | Laravel API for deal metadata, access and audit; README expressly excludes binary document storage | MIT. Architectural reference; the standalone M&A app encrypts document content in its own database. |
| [deal-room](https://github.com/RINDOGATAN/deal-room) `069323a` | Next.js/tRPC/Prisma contract-negotiation product | AGPL-3.0 upstream. Different product/runtime; no code copied, and its hosted paid features are not represented as installed. |

GitHub's latest recorded pushes at inspection were 2026-09-29 (due-diligence-agents), 2026-07-23 (claude-legal-skill), 2026-05-08 (awesome-private-equity), 2026-03-13 (deal-room-api) and 2026-10-22 (deal-room). These dates describe repository activity, not a guarantee of maintenance or security review. The Python agent CLI requires a model account and may incur charges; the legal skill requires an agent host; the curated list has no executable UI. Their output should never be treated as professional legal or financial advice.

The independent system supports persistent deal records, encrypted uploads (8 MB limit), explicit access grants, audit history, manually entered findings with source references, text quote matching, team review status, and JSON evidence reports. Quote matching proves only that text exists in the file, not the truth of an analysis. PDF/DOCX text extraction, automated cross-domain agents, legal advice and professional diligence conclusions are **not implemented**. `ai-assisted` is a provenance label for user-supplied analysis, not a claim that an agent ran.

## Reference website

The requested [presentation URL](https://zoharbabin.com/due-diligence-agents/marketing/presentation.html) returned HTTP 403 through the cloud proxy on 2026-10-24. The upstream repository supplies a single self-contained interactive page at [`docs/marketing/presentation.html`](https://github.com/zoharbabin/due-diligence-agents/blob/6950efd/docs/marketing/presentation.html); inspection found two local image references and no linked local HTML pages. We preserved that HTML byte-for-byte (`sha256 a26305156a9f6c6d4206fa62f23e8fd685d09aa603b7a9c203a6905fd89b9179`) and copied the two referenced screenshots. Because the live host was inaccessible, visual equivalence to the current live website is **NOT VERIFIED**. The source contains inline styles, animations and script; no substitute artwork was invented.

## Deployment requirements

The standalone M&A app uses a persistent local PGlite directory and a private key file by default. Remote/Postgres hosting requires `MA_DATABASE_URL`, `MA_SESSION_SECRET`, `MA_ENCRYPTION_KEY` and `MA_SETUP_TOKEN` for first-time setup. Do not deploy it to ephemeral Vercel functions. It is independent of Fatura's production database and keys. Never commit these secrets or upload real diligence data to a temporary preview.
