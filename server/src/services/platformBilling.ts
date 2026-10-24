import type { Db } from '../db/client';
import { HttpError } from '../http';

/** Compare-and-set the invoice inside the caller's transaction; prevents two payment sources settling it twice. */
export async function settlePlatformInvoice(db: Db, invoiceId: string, payment: Record<string, unknown>) {
  const [row] = await db.query<{ data: { tenantId: string; number: string } }>(
    `UPDATE platform SET data = jsonb_set(jsonb_set(data, '{status}', '"paid"'::jsonb), '{payment}', $2::jsonb, true), updated_at = now()
     WHERE kind = 'invoices' AND id = $1 AND data->>'status' IN ('open', 'overdue') RETURNING data`,
    [invoiceId, JSON.stringify(payment)],
  );
  if (!row) throw new HttpError(409, 'already_settled', 'Invoice is no longer open for payment.');
  return row.data;
}
