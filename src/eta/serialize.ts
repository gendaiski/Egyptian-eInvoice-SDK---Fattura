/**
 * ETA canonical serialization used to compute the document hash that the issuer
 * signs (CAdES-BES). Rules, per the SDK "Document serialization approach":
 *  - property names are upper-cased and quoted;
 *  - simple values are quoted as-is;
 *  - objects are serialized recursively after their quoted name;
 *  - each array element is preceded by the quoted array name;
 *  - the `signatures` property is excluded.
 */
export function serializeForSigning(value: unknown, name?: string): string {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    const key = `"${(name ?? '').toUpperCase()}"`;
    return value.map((v) => key + serializeForSigning(v)).join('');
  }
  if (typeof value === 'object') {
    let out = '';
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (k === 'signatures' || v === undefined || v === null) continue;
      if (Array.isArray(v)) out += `"${k.toUpperCase()}"` + serializeForSigning(v, k);
      else if (typeof v === 'object') out += `"${k.toUpperCase()}"` + serializeForSigning(v);
      else out += `"${k.toUpperCase()}"` + `"${String(v)}"`;
    }
    return out;
  }
  return `"${String(value)}"`;
}

/** SHA-256 hex digest of the serialized document (Web Crypto; works in browser and Node 20+). */
export async function documentHash(doc: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(serializeForSigning(doc));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
