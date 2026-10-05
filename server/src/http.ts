/** Error with an HTTP status and a stable machine code; rendered as { error: { code, message, details? } }. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}
