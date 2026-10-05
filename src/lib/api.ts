import { API_BASE } from '@/env';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: unknown) { super(message); }
}

/** JSON call to the Fatura API with the session cookie. Throws ApiError with the server's message. */
export async function api<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      method, credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the Fatura server. Check your connection and try again.');
  }
  const text = await res.text();
  const json = text ? (() => { try { return JSON.parse(text); } catch { return undefined; } })() : undefined;
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'error', json?.error?.message ?? `Request failed (${res.status}).`, json?.error?.details);
  return json as T;
}

/** Surfaced by components inside the toast provider (see ApiErrorToaster). */
export function reportApiError(e: unknown) {
  const message = e instanceof ApiError ? e.message : (e as Error)?.message ?? 'Something went wrong.';
  window.dispatchEvent(new CustomEvent('fatura:error', { detail: message }));
}
