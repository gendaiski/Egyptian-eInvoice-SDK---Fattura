import qrcode from 'qrcode-generator';
import { useMemo } from 'react';

/** Crisp vector QR (one path), used for the ETA public verification link on every valid document. */
export function QR({ value, size = 112, className }: { value: string; size?: number; className?: string }) {
  const { d, n } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    let path = '';
    for (let r = 0; r < count; r++) for (let c = 0; c < count; c++) if (qr.isDark(r, c)) path += `M${c + 2},${r + 2}h1v1h-1z`;
    return { d: path, n: count + 4 };
  }, [value]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${n} ${n}`} className={className} role="img" aria-label="QR code" shapeRendering="crispEdges">
      <rect width={n} height={n} fill="#fff" />
      <path d={d} fill="#111" />
    </svg>
  );
}
