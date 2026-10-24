# Fattura Bahrain

A separate Bahrain accounting and VAT workpaper application. It runs a FastAPI backend, a responsive browser interface, and a persistent SQLite database. It does **not** change Fattura Egypt.

**GitHub review location:** [`codex/fattura-bahrain-beta`](https://github.com/gendaiski/Egyptian-eInvoice-SDK---Fattura/tree/codex/fattura-bahrain-beta). GitHub denied this connection permission to create a new repository, so this is a standalone branch with its own files and history inside the existing Fattura repository. The Egypt branches were not changed. This is not the previously mentioned Bahrain source repository.

## Run locally

On Windows PowerShell, from this repository:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m bahrain_app.server
```

Open <http://127.0.0.1:8797/> on the same computer. See [START_HERE.md](START_HERE.md) for Linux and macOS, port selection, data storage and stopping/restarting. The first screen creates the company and owner account; no demo password is bundled. Local data is ignored by Git.

## Working full-stack scope

| Area | Implemented |
| --- | --- |
| Frontend | Responsive overview, documents, payments, bank matching, VAT workpapers, books, auditor access, operations; light and dark modes. |
| Backend | FastAPI routes, SQLite persistence, owner/auditor authentication, session cookie, CSRF on owner mutations, audit events, CSV exports and owner database backup. |
| Accounting | BHD three-decimal arithmetic; balanced document, payment and manual journals; receivables/payables; trial balance and simple revenue, expense and book-profit view. |
| Bank matching | Manually entered signed statement lines; one-to-one matching to a recorded payment with the same amount and direction. |
| VAT preparation | Standard 10%, zero-rated, exempt and out-of-scope document classifications; recoverable input VAT; versioned period workpapers; locked period after receipt capture. |
| Auditor | Read-only account, CSV access and immediate revocation of active sessions. |
| NBR handoff | Guide an authorized person to the official NBR portal, then record the receipt/reference they supply. |

**There is no direct NBR submission.** Current official API access was not verified, and this app does not collect NBR credentials or claim that a recorded receipt was checked with the authority. Its workpaper is not a full mapping of every official NBR return field. An accountant must review tax treatment and the complete underlying books before a real return is filed. See [regulatory research](docs/REGULATORY-RESEARCH.md).

The current scope also excludes a real bank feed, automatic reconciliation, payroll, asset depreciation, attachments, complete financial statements, multi-company access, automated backup, and production hosting controls. The manual journal supports opening balances and other non-invoice postings but does not by itself establish complete books.

## Verification

Install the optional test dependency `httpx`, then run:

```bash
python -m unittest discover -s tests -v
```

Eight backend checks exercise accounting precision, posting, bank matching, VAT workpapers, filing receipt capture, auditor restrictions, CSV/backup, and restart persistence. A browser run on a fresh temporary database completed setup, document/payment entry, bank matching and manual journal posting with zero page errors. [Operations screen](docs/operations-dark.png) and [overview](docs/overview-dark.png) were captured from that run. These are **local tests**; a public deployment, the user's Windows installation and NBR integration have not been verified.

## Security and deployment status

The server binds to `127.0.0.1` only. The SQLite file lives in `.data/bahrain.sqlite` by default. Back up and protect the database because it contains company records and password hashes. Do not make this server publicly reachable without production authentication hardening, TLS, rate limiting, tested backup/restore and operational monitoring. Its cookie settings are intended for localhost.

## Source provenance

The existing Bahrain repository mentioned in another local Codex chat was not accessible to this cloud task, and no Bahrain repository was visible in the connected account at the time of development. This standalone code was created here from the local review edition, not copied from Fattura Egypt or from third-party VAT modules. When the existing Bahrain repository URL is supplied, compare it and integrate only compatible changes rather than overwriting its work.
