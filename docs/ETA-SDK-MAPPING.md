# ETA SDK → Fatura mapping

How each part of the ETA eInvoicing SDK (https://sdk.invoicing.eta.gov.eg) is used in the product.

## Environments and authentication

| | Identity (OAuth2) | API |
|---|---|---|
| Pre-production | `https://id.preprod.eta.gov.eg/connect/token` | `https://api.preprod.invoicing.eta.gov.eg` |
| Production | `https://id.eta.gov.eg/connect/token` | `https://api.invoicing.eta.gov.eg` |

- Grant: `client_credentials`, scope `InvoicingAPI`. Each taxpayer registers Fatura as an ERP
  system on the ETA portal and receives a client ID/secret **per environment**.
- UI: Onboarding step 3, Settings → ETA connection (environment switch with confirmation, test
  connection = token + Get Document Types). Secrets are stored server-side only.

## API operations

| SDK operation | Endpoint | Where in Fatura |
|---|---|---|
| Login as taxpayer system | `POST /connect/token` | Settings → ETA connection, onboarding |
| Get document types / versions | `GET /api/v1.0/documenttypes` | Drives cancel/reject windows (`workflowParameters`) shown on document detail and the received inbox |
| Submit documents | `POST /api/v1/documentsubmissions` | Composer "Sign & submit", bulk submit on the documents list, recurring auto-submit |
| Get submission | `GET /api/v1.0/documentSubmissions/{uuid}` | Submissions log (overall status: InProgress / Valid / PartiallyValid / Invalid) |
| Get document details | `GET /api/v1.0/documents/{uuid}/details` | Polling after submit; **ETA validation results** card shows every validator step and error `code` / `propertyPath` |
| Get document printout | `GET /api/v1.0/documents/{uuid}/pdf` | Official PDF option (Fatura also renders its own bilingual printout) |
| Cancel document | `PUT /api/v1.0/documents/state/{uuid}/state` `{status:"cancelled", reason}` | Document detail → Cancellation window (issuer, within window) |
| Reject document | same endpoint, `{status:"rejected", reason}` | Received document detail → Rejection window (receiver, once) |
| Decline cancellation | `PUT /api/v1.0/documents/state/{uuid}/decline/cancelation` | Received inbox call-outs, dashboard "needs attention" |
| Decline rejection | `PUT /api/v1.0/documents/state/{uuid}/decline/rejection` | Sent document with `pending = rejection_requested` |
| Search documents | `GET /api/v1.0/documents/search` (continuationToken) | Received documents sync (direction = Received); reconciliation jobs. Replaces *Get Recent Documents* |
| Request document package | `POST /api/v1.0/documentPackages/requests` | Tax reports → "ETA package", Settings → Data → archive |
| Create EGS code usage | `POST /api/v1.0/codetypes/requests/codes` | Items & codes → "Request EGS codes" review dialog |
| My code usage requests | `GET /api/v1.0/codetypes/requests/my` | Code status column (Submitted / Approved / Rejected) |
| Taxpayer notifications | `GET /api/v1/notifications/taxpayer` | Bell menu, dashboard tasks |
| Submit receipts (POS) | `POST /api/v1/receiptsubmissions` | E-receipts (POS) page |

## Document model (v1.0)

`src/eta/types.ts` mirrors the JSON field-for-field (issuer, receiver, address with `branchID`,
`invoiceLines` with `unitValue`, `discount`, `taxableItems`, totals, `references`, `payment`,
`delivery`, `signatures`). `toEtaDocument()` in `src/store/model.ts` produces the exact payload, and
the composer's **ETA JSON** button shows it together with the canonical string and SHA-256.

Rules enforced by pre-flight (`src/eta/validate.ts`) before signing:

- Issuer RIN is 9 digits, branch and activity code are set, `internalID` is unique.
- `dateTimeIssued` is UTC and not in the future. Back-dated documents get a warning.
- Receiver `B` needs RIN, name and full address. Receiver `P` needs a 14-digit national ID once the
  total reaches the threshold (default EGP 50,000, admin-configurable). Receiver `F` must be non-EG.
- Credit/debit notes must carry `references` to the original invoice UUID.
- Export documents must go to a foreign receiver.
- Every line needs an item code, quantity > 0, price > 0, and an exchange rate for non-EGP currencies.
  A missing T1 line is a warning, because exempt items use T1 with an exemption subtype.
- Item codes not yet *Approved* produce a warning, because they come back Invalid from the Code validator.

## Tax calculation (`src/eta/calc.ts`)

Per line, in this order:

```
salesTotal       = quantity × unitValue.amountEGP
netTotal         = salesTotal − discount.amount
taxable fees     T5–T12: rate × netTotal, or fixed amount        → totalTaxableFees
T3               fixed amount
T2               rate × (netTotal + totalTaxableFees + valueDifference + T3)
T1 (VAT)         rate × (netTotal + totalTaxableFees + valueDifference + T2 + T3)
T4 (WHT)         rate × (netTotal − itemsDiscount)               (deducted)
non-taxable fees T13–T20: rate × netTotal, or fixed amount
total            = netTotal + totalTaxableFees + nonTaxableFees + T1 + T2 + T3 − T4 − itemsDiscount
```

Document totals sum the lines, group `taxTotals` by tax type, and subtract `extraDiscountAmount`.
Amounts are rounded to 5 decimals as ETA accepts. Covered by `calc.test.ts`.

## Signing

- Canonical serialization (`src/eta/serialize.ts`): upper-cased quoted property names, quoted
  values, array elements each prefixed by the array name, `signatures` excluded. SHA-256 of that
  string is signed as **CAdES-BES** with the taxpayer's certificate. Signature type `I` is the issuer.
- Signing methods offered: USB token through the *Fatura Signer* local agent (default), on-premise
  HSM, or a cloud eSeal. Recurring auto-submit needs an unattended method; with a USB token, runs
  wait as drafts and the user is notified.

## Statuses

Fatura-only: `Draft`, `Signing`. ETA: `Submitted` → `Valid` | `Invalid`; then `Cancelled` (issuer)
or `Rejected` (receiver). An Invalid document has no tax effect: **Correct & resubmit** creates a
new draft with a new number and keeps the invalid one on record.

## Payment models vs ETA

| Model | What ETA receives | What Fatura tracks |
|---|---|---|
| One payment | 1 invoice | due date from terms, partial payments, aging |
| Recurring | 1 new invoice per run, dated the run day (no future-dated documents) | schedule, next runs, auto-submit / email / draft-for-approval |
| Installments | 1 invoice for the full amount (VAT due at issuance) | down payment + N installments; rounding remainder on the last row |

## To verify against the live SDK

The SDK site was blocked from the build environment, so confirm these before go-live:

1. Exact cancellation, rejection and decline windows per document type. The UI reads them from
   `workflowParameters`, and the mock uses 7 days.
2. Export document type codes (`EI` / `EC` / `ED` in the mock) and the export-specific fields.
3. The national-ID threshold for individual receivers on invoices (EGP 50,000 in the seed) and on
   e-receipts (EGP 150,000 per Receipt v1.2).
4. Submission batch limits (documents per call and payload size) for the bulk-submit chunker.
5. The full tax subtype list, which is synced from `/codes/tax-types` by the admin Reference data job.
6. The e-receipt (v1.2) header fields and POS authentication headers.
