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
