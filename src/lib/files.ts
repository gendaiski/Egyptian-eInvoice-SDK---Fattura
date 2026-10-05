import { IS_PREVIEW_HOST } from '@/env';

/** Saves a text file. Returns false on the preview host, which blocks downloads, so callers can explain. */
export function saveTextFile(name: string, content: string, type = 'text/csv'): boolean {
  if (IS_PREVIEW_HOST) return false;
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
  return true;
}

/** Opens the print dialog (Save as PDF). Returns false where printing is unavailable. */
export function printPage(): boolean {
  if (IS_PREVIEW_HOST) return false;
  window.print();
  return true;
}
