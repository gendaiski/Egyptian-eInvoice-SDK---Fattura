# Core flows and UX decisions

## 1. First run: from sign-up to first valid invoice
Sign up → **Onboarding** (4 steps, each must pass before the next unlocks):
1. *Company*: RIN is verified against the taxpayer registry, then the legal names (EN/AR) and the activity code.
2. *Head office*: the address must match the ETA registration and is sent as `branchID 0`.
3. *ETA connection*: pre-production is recommended first. "Test connection" proves the credentials.
4. *Signing*: install Fatura Signer, plug in the token, then "Detect". A test signature checks that the certificate belongs to the RIN.

The trial runs on pre-production, so mistakes cost nothing. The switch to production is an
explicit confirmation in Settings.

## 2. Issue an invoice (the composer)
- One page. The **summary rail** is always visible: live totals by tax type, a **pre-flight
  checklist**, and the actions. On mobile it collapses into a sticky bottom bar.
- Picking a catalog item fills the code, unit, price and taxes. Rejected codes can't be picked.
- Before the first submit attempt, pre-flight items show as a neutral to-do list. After an
  attempt they turn red. Errors block submission; warnings don't.
- "Sign & submit" saves the document, then the detail page shows the lifecycle live:
  Draft → Signed → Submitted → Valid/Invalid.
- "ETA JSON" shows the exact payload, the canonical string and the hash, which helps accountants and integrators.

## 3. How will the customer pay?
Three cards. Each plan explains its tax consequence in one line, right where the choice is made.
- **One payment**: payment terms with the computed due date.
- **Recurring**: frequency × interval, start, end (never / after N / on date), and what happens on
  each run (draft for approval / auto-submit / auto-submit + email), with a preview of the next 6 dates.
  If the start date is in the future, only the schedule is saved. Nothing is pre-issued.
- **Installments**: count, frequency, down payment %, and first due date, with a live schedule
  that sums exactly to the invoice total.

## 4. After issue
- **Document detail**: printable bilingual invoice with the ETA verification QR, ETA record (UUID,
  submission), validation results, a cancellation window countdown, credit/debit note shortcuts,
  payments and the installment tracker, and an activity timeline.
- **Invalid**: the failing validator and the property path are shown. "Correct & resubmit" clones to a new draft.
- **After the cancel window**: the card says so and offers a credit note instead.

## 5. Getting paid
Payments & installments: aged buckets (not due / 1–30 / 31–60 / 61–90 / 90+), open invoices with
one-click "Record payment" (the amount is pre-filled with the next installment), installment plan
cards with per-installment status bars, and a payment log.

## 6. Purchases inbox
Supplier documents arrive via Search Documents. Pending issuer cancellations are pinned on top
with Accept / Decline. Rejection needs a reason (quick presets) and is limited to once per document.

## 7. Dashboard
It leads with a **Needs your attention** queue (invalid documents, cancellation requests, drafts,
certificate expiry, rejected codes). KPIs follow: issued this month, output VAT, receivables with
the overdue amount, and ETA acceptance rate. Then a 6-month chart, submission outcomes, recent
documents and **Coming up** (recurring runs and installments due, with overdue items flagged).

## 8. Platform admin
The overview shows MRR, traffic and a deduplicated attention list. Tenants can be changed between
plans, suspended (read and export stay open, as tenants must keep records), or viewed through a
read-only, audited support session. Plans are priced four ways. Billing has dunning and
mark-paid actions. ETA health shows p95 latency against an alert threshold, transport errors,
invalid-reason breakdown and endpoint status. Reference data syncs the SDK code tables to every tenant.

## Accessibility and localisation
- Labels sit above fields, errors below. Focus rings are visible, dialogs close on Esc and return
  focus, a skip link is provided, and status is never shown by colour alone (icon + text).
- Each chart has a hidden table equivalent and a keyboard-focusable hover tooltip.
- In Arabic the layout mirrors via logical properties. Latin digits are kept for reconciliation
  with bank and portal exports, and codes, IDs and IBANs stay LTR.
