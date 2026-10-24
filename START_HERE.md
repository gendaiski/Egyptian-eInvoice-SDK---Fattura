# Fattura Bahrain local review edition

This is a separate, locally running Bahrain beta. It does not use or change Fattura Egypt. It is not yet integrated into the user's previously mentioned Bahrain repository because that repository's URL has not reached this task.

## Start on Windows

From PowerShell in this folder, run:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m bahrain_app.server
```

Open <http://127.0.0.1:8797/> in a browser on **the same computer**. If port 8797 is occupied, set `FATTURA_BH_PORT` to a free local port before starting. The server binds only to `127.0.0.1`.

Create the owner account in the first screen. The local SQLite database is created at `.data/bahrain.sqlite`. Use Operations → Download database backup and store the copy privately; it contains confidential accounting data and password hashes. A fresh checkout does not contain accounts or data.

To stop, press `Ctrl+C` in the running PowerShell window. To restart, run the final command again from this folder. Data persists across restarts in `.data/bahrain.sqlite`.

## Start on Linux or macOS

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m bahrain_app.server
```

## Available workflow

1. Create a company and owner login.
2. Post a sales or purchase document; the app creates a balanced journal entry in BHD fils.
3. Record a customer receipt or supplier payment against that document.
4. Prepare a period VAT workpaper and inspect the account balances.
5. Export the general ledger, payments and VAT workpapers as CSV.
6. Enter a bank-statement line and match it to a recorded payment, or post a balanced manual journal under Operations.
7. Create a read-only auditor login and revoke it when finished.
8. If an authorised person files through the official NBR portal, record the receipt reference. This is self-reported evidence, **not a verified NBR filing status**.

The app does **not** submit to NBR, connect directly to a bank, automatically reconcile bank feeds, map every official NBR return box, handle all VAT exceptions, or generate complete statutory financial statements. Review figures with a Bahrain-qualified accountant before filing. Live NBR guidance was unavailable from this cloud environment; the [regulatory research](docs/REGULATORY-RESEARCH.md) is based on a pinned archive and requires current verification.

This is a local review build. Its session cookie and deployment posture are for localhost; do not expose the server on a public interface. It has manual backup download but no production backup automation, migration framework, rate limiting or TLS configuration.

## Verification

Run `python -m unittest discover -s tests -v` after installing the runtime and test dependency `httpx`. Eight backend checks cover accounting, bank matching, VAT preparation, receipt capture, auditor restrictions and revocation, restart persistence, protections, CSV export and backup. A fresh-database browser test completed owner setup, document/payment entry, bank matching and a manual journal. These checks do not verify an NBR connection or the user's Windows installation.

