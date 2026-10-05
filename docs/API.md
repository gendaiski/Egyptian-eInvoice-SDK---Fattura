# Fatura integration API

Three ways in, each with its own credential:

| Who | Base path | Credential |
|---|---|---|
| ERPs, scripts, accounting systems | `/api/v1/ext` | `Authorization: Bearer fat_live_…` — created in **Settings → API & webhooks** |
| Fatura Signer (USB token PC) | `/api/v1/signer` | `Authorization: Agent fat_agent_…` — created in **Settings → Signing → Pair a signer** |
| The Fatura web app | `/api/v1` | HTTP-only session cookie from `POST /api/v1/auth/login` |

Keys and agent tokens are shown once, stored as SHA-256 hashes, and can be revoked at any time.
All bodies are JSON (UTF-8, Arabic unescaped). Errors look like:

```json
{ "error": { "code": "validation_failed", "message": "Human-readable reason", "details": [ … ] } }
```

## Documents

### `POST /api/v1/ext/documents` — create (and optionally submit)

Idempotent by `internal_id`: sending the same `internal_id` again returns the existing document with
`"idempotent_replay": true` instead of creating a duplicate.

```json
{
  "type": "I",
  "internal_id": "ERP-2026-00042",
  "customer": "c_123",
  "lines": [
    { "item": "it_erp_day", "quantity": 5 },
    { "description": "Travel", "item_code": "EG-123456789-TRAVEL", "item_type": "EGS", "unit_type": "EA",
      "quantity": 1, "unit_price": 1500, "taxes": [{ "type": "T1", "subType": "V009", "rate": 14 }] }
  ],
  "payment_plan": { "kind": "installments", "count": 3, "down_payment_pct": 20, "frequency": "monthly" },
  "submit": true
}
```

- `type`: `I` invoice, `C` credit note, `D` debit note, `EI` export invoice. Notes need `references` (ETA UUIDs).
- `customer`: a Fatura customer id, or an inline party `{ "type": "B" | "P" | "F", "id": "…", "name": "…", "address": { … } }`.
- `lines[].item`: a Fatura item id (code, unit, price and taxes come from the item), or give them inline.
- `payment_plan`: omit for one payment; `{ "kind": "one-time", "terms": "net30" }`, recurring or installments.
  ETA always receives one tax document; the plan drives Fatura's receivables.
- `submit: true` runs pre-flight validation, signs (test certificate, HSM or queued for the USB signer) and submits to ETA.

Response `201`:

```json
{
  "id": "d…", "internal_id": "ERP-2026-00042", "type": "I", "status": "Submitted",
  "eta_uuid": "…", "eta_long_id": "…", "total": 7980, "validation_steps": [],
  "installments": [ { "n": 0, "label": "down", "dueDate": "2026-10-05", "amount": 1596, "paid": 0 } ],
  "payments": [], "public_url": "https://invoicing.eta.gov.eg/documents/…/share/…"
}
```

Statuses: `Draft → Signing → Submitted → Valid | Invalid`, then `Cancelled` / `Rejected`.
Pre-flight failures return `422` with the failing rules in `details` and nothing is sent to ETA.

### Other document endpoints

| Method | Path | Notes |
|---|---|---|
| `GET` | `/documents?status=Valid,Invalid&direction=sent\|received&issued_from=&issued_to=&limit=50&offset=0` | `{ data, total, limit, offset }` |
| `GET` | `/documents/{id}` | `id` may be the Fatura id, the ETA UUID or your `internal_id` |
| `POST` | `/documents/{id}/submit` | Submit a draft |
| `POST` | `/documents/{id}/cancel` | `{ "reason": "…" }` — inside ETA's cancellation window |
| `GET` / `POST` | `/customers` | List / create customers |
| `GET` | `/items` | Items with EGS/GS1 codes and code-request status |

## Webhooks

Register HTTPS endpoints in **Settings → API & webhooks**. Each delivery is a `POST`:

```
X-Fatura-Event: document.validated
X-Fatura-Delivery: evt_…
X-Fatura-Signature: sha256=<hex HMAC-SHA256 of the raw body with your endpoint secret>
```

Events: `document.submitted`, `document.validated`, `document.invalid`, `document.cancelled`,
`document.rejected`, `document.cancellation_declined`, `document.rejection_declined`,
`document.accept_cancellation`, `received.created`, `payment.recorded`.
Failed deliveries are retried from a transactional outbox with exponential back-off (30 s × 2ⁿ, up to 8 attempts). Verify the signature before trusting the body:

```js
const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(req.headers['x-fatura-signature']));
```

## Signer agent protocol

Used by `signer-agent/agent.ts`; documented for teams that build their own signer.

| Method | Path | Body / response |
|---|---|---|
| `POST` | `/api/v1/signer/heartbeat` | `{ version, host, certificate? }` → marks the agent online; a certificate switches the tenant to USB-token signing |
| `GET` | `/api/v1/signer/jobs?wait=25` | Long-poll (max 25 s). `{ jobs: [{ id, items: [{ docId, canonical }] }] }`; unfinished jobs are re-offered after 2 minutes |
| `POST` | `/api/v1/signer/jobs/{id}` | `{ signatures: [{ docId, value }] }` (base64 CAdES-BES) or `{ error }` |

The agent signs the ETA canonical string with the token's key (PKCS#11) and returns a detached CAdES-BES
signature. The server verifies it against the tenant's certificate before submitting to ETA.

## Scheduler

`POST /api/cron/tick` (header `Authorization: Bearer $CRON_SECRET`) runs recurring invoices, polls ETA for
submitted documents, refreshes code requests, syncs received documents and delivers webhooks.
The Node server runs it every minute; on Vercel it is a cron job.
