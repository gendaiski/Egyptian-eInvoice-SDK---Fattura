import { useId } from 'react';
import { cx } from './ui';

/**
 * Fatura's signature graphic: a tax-office seal. Used sparingly — once per marketing page,
 * and as the "Valid" moment in product empty states. Text runs around the ring in both scripts.
 */
export function Stamp({ size = 132, label = 'VALID', sub = 'صالحة', ring = 'ETA · E-INVOICE · فاتورة إلكترونية · ', className, tone = 'accent' }: {
  size?: number; label?: string; sub?: string; ring?: string; className?: string; tone?: 'accent' | 'ok' | 'gold';
}) {
  const id = useId().replace(/:/g, '');
  const color = { accent: 'text-accent', ok: 'text-ok', gold: 'text-gold' }[tone];
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" className={cx(color, className)} role="img" aria-label={`${label} — ${sub}`} style={{ direction: 'ltr' }}>
      <defs><path id={`ring-${id}`} d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" /></defs>
      <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="100" cy="100" r="86" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" />
      <circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeWidth="2" />
      <text fill="currentColor" fontSize="13" fontWeight="600" letterSpacing="2.4" style={{ fontFamily: 'var(--font-display)' }}>
        <textPath href={`#ring-${id}`} startOffset="0">{ring.repeat(2)}</textPath>
      </text>
      <path d="M78 92 l14 14 l30 -30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <text x="100" y="128" textAnchor="middle" fill="currentColor" fontSize="15" fontWeight="700" letterSpacing="3" style={{ fontFamily: 'var(--font-display)' }}>{label}</text>
      <text x="100" y="146" textAnchor="middle" fill="currentColor" fontSize="12" fontWeight="600" style={{ fontFamily: 'var(--font-display)' }}>{sub}</text>
    </svg>
  );
}
