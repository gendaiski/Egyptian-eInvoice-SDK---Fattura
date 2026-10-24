# Fattura Bahrain — source intake and development study

Status: **research record for the separate local Bahrain beta** (24 October 2026). Start instructions are in [START_HERE.md](../START_HERE.md). Product and test status are in the [root README](../README.md).

The user says the Bahrain source link is in the local Codex chat **“Token Works WorkspaceWebsite Twins · Brain Studio ·”**. This cloud task can list that chat but its local host is unavailable to `read_thread`. The GitHub account visible here has 58 repositories; none is a Fattura Bahrain repository or branch. The separate Egypt repository has only `claude/fatura-frontend`, `codex/fattura-egypt-v2`, and `codex/fattura-beta`. The correct GitHub URL is needed before cloning. Do not substitute the Egypt source or a third-party Bahrain VAT module.

## Working local review edition

The `bahrain_app/` code is an independent FastAPI and SQLite edition built in this cloud workspace while the previously mentioned Bahrain repository was unavailable. It is **not deployed or installed on the user's Windows computer**. See the root README for its current implemented functions.

No NBR connection or official filing was tested. The current accounting coverage is incomplete for statutory books: it lacks payroll, automated bank feeds, asset depreciation and complete statements. The app is a **local beta, not a compliant filing product**.

## Regulatory findings and evidence boundary

The authority's name is **National Bureau for Revenue (NBR)**, rather than NRA. The NBR's VAT General Guide v1.14, marked updated 11 March 2026 in the archived copy, says:

- The standard VAT rate is 10% from 1 January 2022; zero-rated and exempt supplies have separate treatment (section 2).
- A VAT return summarizes output VAT and recoverable input VAT for a period (section 13.3.1). The guide describes monthly periods for annual supplies above BHD 3 million and quarterly periods otherwise, subject to NBR decisions (section 13.2).
- A return and net VAT payment are due by the last day of the month after the VAT period; a nil return is still required (section 13.3.2).
- Returns are submitted **through the NBR online portal** by the taxpayer or a person officially authorized to file on their behalf. NBR's receipt is the official submission confirmation (section 13.3.3).
- The guide lists chronological accounting books, VAT invoices and credit/debit notes, balance sheet and profit and loss accounts, wage records, fixed assets, inventory, and customs documents among records to retain (section 14.1.1).
- The archived guide describes a ten-year general record-retention period following a 2024 extension and a fifteen-year period for real-estate records (section 14.2). Recheck current NBR guidance before encoding retention or deletion rules.
- The guide says a VAT agent/representative appointment is made on the NBR portal (section 19.3). An auditor invited into Fattura is not automatically an NBR-authorized filing agent.

The official NBR site could not be opened from this cloud environment: the network proxy returned HTTP 403 for `www.nbr.gov.bh` and `vat.nbr.gov.bh`. The findings above were checked against a [third-party archive of NBR guidance](https://github.com/worldwidelaw/legal-sources/blob/fb73e4478edcbe31ec06f3936fbefeb005ceb47b/sources/BH/NBR-TaxGuidance/sample/VAT_General_guide.json), fetched in April 2026. Its provenance points to the [NBR VAT General Guide](https://www.nbr.gov.bh/publications/view/VAT_General_guide). **Current October 2026 rules and the portal's live functions are not independently verified here.** A current NBR check and Bahrain tax-professional review are release gates.

A cloud environment network draft now adds `nbr.gov.bh` and `*.nbr.gov.bh` while preserving the existing allowed domains. It is saved for review but **not published or applied**, so direct NBR verification remains blocked until the environment owner reviews, saves, and publishes that draft.

### Direct electronic filing

The inspected guide documents portal filing. No official developer submission API, credentials scheme, or partner integration contract was verified. Thus **direct server-to-NBR filing is unverified**. Do not implement a browser bot, collect portal passwords, or report that a generated return was filed. The first usable product should calculate and review a return, guide an authorized person through the official portal, then capture the NBR receipt and payment reference. A direct submission adapter can be built only after NBR provides current integration documentation and authorizes this application.

Bahrain's VAT-return workflow should be treated separately from Egypt's per-document ETA e-invoice pipeline. The inspected NBR guide does not establish an Egyptian-style invoice clearance endpoint for Bahrain.

## Proposed product modules

| Module | Actual capability to build | Acceptance check |
| --- | --- | --- |
| Bahrain company profile | VAT registration number, NBR filing frequency/period, effective tax rules, chart of accounts, fiscal calendar | A company can set a monthly or quarterly period without changing Egypt tenant data |
| VAT document register | Sales and purchase invoices, credit/debit notes, imports, exports, reverse-charge evidence, source attachments, tax point | Every return line traces to immutable source documents and a rule version |
| Accounting books | Double-entry posting from documents and additional bank, expense, payroll, fixed-asset, inventory and opening-balance inputs | Trial balance balances; journal corrections create reversals rather than silently editing posted entries |
| Payments ledger | Invoice obligations, customer receipts, supplier payments, bank transactions, refunds, allocations, fees, settlement date and reconciliation | A bank line can be matched and later un-matched with an audit record; invoice balances agree with AR/AP ledgers |
| VAT workpaper and return | Output/input VAT classification, exemptions/zero rating, adjustments, box mapping, period close, nil return, exception queue | Return totals reconcile to VAT control accounts and source documents; reviewer can inspect differences |
| Filing handoff | Preparer → auditor/reviewer → authorized signatory; export return figures and evidence, open NBR portal, record receipt and payment reference | The system stays “Prepared” until an official receipt is recorded; rejected/amended returns retain versions |
| Auditor workspace | Engagement-scoped invitation, read-only books and attachments, requests/questions, review notes, controlled adjustment proposals, report exports | Auditor cannot alter posted books or see another company; every access and approval is logged |

An invoice system alone cannot produce complete books of accounts. Opening balances, purchases and expenses, bank movements, payroll, fixed assets and other non-invoice transactions must be imported or entered and reconciled before financial statements can be represented as complete.

### Access and evidence design

- Keep taxpayer owner, bookkeeper, auditor, VAT agent, and platform operator roles distinct. Auditor access is read-only by default, scoped to a company and engagement, time-limited and revocable.
- If an auditor will **file** through NBR, record their separately verified NBR agent/representative authorization; an app role is insufficient.
- Preserve the original document, journal entry, author, timestamp, tax rule, reviewer decision, submission receipt and payment evidence. Use period locks with explicit reopen approval and reversal entries.
- Keep VAT payable distinct from customer payment receipts. Tax point and cash settlement can fall in different periods. Use BHD values with three-decimal currency precision and explicit rounding tests.
- Exports should include general ledger, trial balance, balance sheet, profit and loss, VAT audit trail, sales/purchase VAT registers, AR/AP aging, payments ledger, bank reconciliation, and an evidence manifest.
- Do not reuse Egypt ETA credentials, signing adapters, or submission claims. Bahrain needs its own regulatory adapter and configuration.

## Implementation sequence after receiving the repository URL

1. Clone the exact Bahrain repository into this workspace and pin its commit. Read its README, licence, architecture, tests and existing accounting, tax and auditor flows. Preserve it as a separate edition from Egypt.
2. Produce a gap matrix against the modules above. Decide whether to extend the existing backend or add bounded services based on actual code; avoid an invented rewrite.
3. Implement accounting core and payments ledger first, with tenant isolation and audited posting. Import the data needed to produce a trial balance.
4. Add Bahrain VAT classification and a versioned return workpaper. Verify field mapping and effective dates against current NBR material and a Bahrain VAT specialist.
5. Build auditor access, approval and evidence exports. Then add NBR portal handoff and receipt capture.
6. Pursue direct NBR submission only if a current official API/partner route is confirmed, licensed and tested in an authorized environment. Production filing requires explicit authorization.

## Sources

- [NBR VAT General Guide, official source URL](https://www.nbr.gov.bh/publications/view/VAT_General_guide) — live access blocked in this environment.
- [Archived guide text, pinned April 2026 capture](https://github.com/worldwidelaw/legal-sources/blob/fb73e4478edcbe31ec06f3936fbefeb005ceb47b/sources/BH/NBR-TaxGuidance/sample/VAT_General_guide.json) — used for the section-level findings above; secondary archive.
- [NBR VAT Agent / VAT Representative Guide, official source URL](https://www.nbr.gov.bh/publications/view/VAT_Agent_VAT_Representative_Guide) and its [pinned archive](https://github.com/worldwidelaw/legal-sources/blob/fb73e4478edcbe31ec06f3936fbefeb005ceb47b/sources/BH/NBR-TaxGuidance/sample/VAT_Agent_VAT_Representative_Guide.json).
- [NBR Simplified VAT Return Form Manual, official source URL](https://www.nbr.gov.bh/publications/view/Simplified_VAT_Return_Form) and its [pinned archive](https://github.com/worldwidelaw/legal-sources/blob/fb73e4478edcbe31ec06f3936fbefeb005ceb47b/sources/BH/NBR-TaxGuidance/sample/Simplified_VAT_Return_Form.json).
- [ERPGulf Bahrain VAT module](https://github.com/ERPGulf/Bahrain_vat/tree/ee750c231ff64f6f2a1cf1420d71938c77608b06) — third-party technical example of VAT sales/purchase reporting in ERPNext; no usable licence was confirmed, so its code is not a source for integration.
