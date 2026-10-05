# Production architecture (the backend this front end expects)

```
Browser (this SPA) ──HTTPS──► Fatura API (multi-tenant)
                                 │
                                 ├─ Postgres (tenants, documents, plans, payments, audit; row-level tenant isolation)
                                 ├─ Queue + workers
                                 │    • submit-worker   → ETA documentsubmissions (batching, idempotency by internalID)
                                 │    • poll-worker     → documents/{uuid}/details until Valid/Invalid
                                 │    • inbox-sync      → documents/search (Received) every N minutes
                                 │    • recurring-cron  → generates the day's runs; routes to signer or draft
                                 │    • reminders       → due / overdue installments (email, WhatsApp)
                                 │    • refdata-sync    → SDK code tables nightly
                                 ├─ Secrets (KMS): per-tenant ETA client secret, never sent to the browser
                                 └─ Signer gateway (WebSocket) ◄── Fatura Signer agent on the customer PC (USB token, PKCS#11)
                                                              ◄── HSM / cloud eSeal connectors
```

## Key rules
- **The private key never leaves the token.** The API sends the SHA-256 of the canonical
  serialization to the agent, and the agent returns a CAdES-BES signature that the API embeds
  under `signatures`.
- **Idempotent submission.** `internalID` is unique per issuer (DB constraint). Retries reuse the same
  signed payload. Transport errors (5xx, 429, timeouts) are retried with exponential backoff, and
  the queue is visible in Admin → ETA health.
- **Tokens.** One OAuth token per tenant and environment, cached until about 5 minutes before expiry.
- **Tenancy.** Every row carries `tenant_id`, enforced by Postgres RLS. Support access is
  read-only, time-boxed and written to the audit log.
- **Retention.** Submitted JSON, signatures, validation results and PDFs are kept for 5 years.
  Export is available even when an account is suspended.
- **Fatura's own billing.** Plans sold monthly, yearly, as installments or as a one-time licence.
  Every platform invoice is itself issued as a valid ETA invoice from Fatura's own RIN.

## Front-end contract
`src/eta/client.ts` (`EtaClient`) lists the operations. The SPA calls Fatura's REST API with the same
shapes, and `src/store/store.tsx#useActions` is the single place to swap the mock for real HTTP calls.
