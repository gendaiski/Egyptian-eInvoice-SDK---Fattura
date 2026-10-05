/**
 * Build target. `memory` is used for the hosted live preview (an artifact frame without
 * real URLs, printing or downloads); `browser` is the normal deployed app.
 */
export const ROUTER_MODE: 'browser' | 'memory' = import.meta.env.VITE_ROUTER === 'memory' ? 'memory' : 'browser';
export const IS_PREVIEW_HOST = ROUTER_MODE === 'memory';

/** Deep link for the preview host: only a bare #token reaches the page, so `#app.documents` → `/app/documents`. */
export function initialPathFromHash(): string {
  try {
    const t = window.location.hash.replace(/^#/, '');
    if (!t || !/^[A-Za-z0-9._~-]+$/.test(t)) return '/';
    return '/' + t.split('.').join('/');
  } catch { return '/'; }
}

/**
 * Data source. `local`: the in-browser demo backend (no server needed, used by the live preview).
 * `api`: the Fatura API server (deployed builds). Set VITE_DATA=api at build time.
 */
export const DATA_MODE: 'local' | 'api' = import.meta.env.VITE_DATA === 'api' ? 'api' : 'local';
export const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
