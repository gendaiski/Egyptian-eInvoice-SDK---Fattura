import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from './ui';

/** Single-series charts in the accent colour. Dual axes are never used: two measures → two charts. */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

const niceMax = (v: number) => {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
};

export interface Datum { label: string; value: number; sub?: string }

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border border-line bg-surface shadow-pop px-2.5 py-1.5 text-[12.5px] whitespace-nowrap" style={{ left, top: y - 8 }}>
      {children}
    </div>
  );
}

export function BarChart({ data, height = 220, format, ariaLabel, highlightLast }: { data: Datum[]; height?: number; format(n: number): string; ariaLabel: string; highlightLast?: boolean }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { t: 12, r: 8, b: 26, l: 72 };
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const step = data.length ? iw / data.length : 0;
  const bw = Math.min(36, Math.max(4, step - 2 - step * 0.28));
  const ticks = [0, 0.5, 1].map((f) => f * max);
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(iw / 56)));
  return (
    <div ref={ref} dir="ltr" className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {ticks.map((t) => {
            const y = pad.t + ih - (t / max) * ih;
            return (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y} y2={y} className="stroke-line" strokeDasharray={t === 0 ? undefined : '2 4'} />
                <text x={pad.l - 8} y={y} dy="0.32em" textAnchor="end" className="fill-ink-subtle text-[11px] tabular">{format(t)}</text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = Math.max(d.value > 0 ? 2 : 0, (d.value / max) * ih);
            const x = pad.l + i * step + (step - bw) / 2;
            const y = pad.t + ih - h;
            const r = Math.min(4, bw / 2, h);
            const active = hover === i;
            const strong = active || (highlightLast && i === data.length - 1 && hover === null);
            return (
              <g key={d.label} tabIndex={0} role="img" aria-label={`${d.label}: ${format(d.value)}`}
                onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none">
                <rect x={pad.l + i * step} y={pad.t} width={step} height={ih} fill="transparent" />
                <path d={`M${x},${y + h}V${y + r}a${r},${r} 0 0 1 ${r},-${r}H${x + bw - r}a${r},${r} 0 0 1 ${r},${r}V${y + h}Z`}
                  className={cx('transition-opacity', strong ? 'fill-accent' : 'fill-accent/55')} />
                {i % labelEvery === 0 && <text x={x + bw / 2} y={height - 8} textAnchor="middle" className="fill-ink-subtle text-[11px]">{d.label}</text>}
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip x={pad.l + hover * step + step / 2} y={pad.t + ih - (data[hover].value / max) * ih} width={width}>
          <div className="font-semibold text-ink tabular">{format(data[hover].value)}</div>
          <div className="text-ink-subtle">{data[hover].label}{data[hover].sub ? ` · ${data[hover].sub}` : ''}</div>
        </Tooltip>
      )}
      <table className="sr-only"><caption>{ariaLabel}</caption><tbody>{data.map((d) => <tr key={d.label}><th>{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </div>
  );
}

export function LineChart({ data, height = 200, format, ariaLabel, threshold }: { data: Datum[]; height?: number; format(n: number): string; ariaLabel: string; threshold?: { value: number; label: string } }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { t: 12, r: 12, b: 26, l: 72 };
  const max = niceMax(Math.max(...data.map((d) => d.value), threshold?.value ?? 0));
  const iw = Math.max(0, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length > 1 ? (i / (data.length - 1)) * iw : iw / 2);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join('');
  const area = `${path}L${x(data.length - 1)},${pad.t + ih}L${x(0)},${pad.t + ih}Z`;
  const labelEvery = Math.ceil(data.length / Math.max(1, Math.floor(iw / 64)));
  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const i = Math.round(((e.clientX - r.left) / r.width) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div ref={ref} dir="ltr" className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line x1={pad.l} x2={width - pad.r} y1={y(f * max)} y2={y(f * max)} className="stroke-line" strokeDasharray={f ? '2 4' : undefined} />
              <text x={pad.l - 8} y={y(f * max)} dy="0.32em" textAnchor="end" className="fill-ink-subtle text-[11px] tabular">{format(f * max)}</text>
            </g>
          ))}
          {threshold && (
            <g>
              <line x1={pad.l} x2={width - pad.r} y1={y(threshold.value)} y2={y(threshold.value)} className="stroke-warn" strokeDasharray="4 3" />
              <text x={width - pad.r} y={y(threshold.value) - 5} textAnchor="end" className="fill-ink-muted text-[11px]">{threshold.label}</text>
            </g>
          )}
          <path d={area} className="fill-accent/10" />
          <path d={path} fill="none" className="stroke-accent" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) => i % labelEvery === 0 && <text key={d.label} x={x(i)} y={height - 8} textAnchor="middle" className="fill-ink-subtle text-[11px]">{d.label}</text>)}
          {hover !== null && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="stroke-ink-subtle" strokeWidth={1} />
              <circle cx={x(hover)} cy={y(data[hover].value)} r={4.5} className="fill-accent stroke-surface" strokeWidth={2} />
            </g>
          )}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
      )}
      {hover !== null && width > 0 && (
        <Tooltip x={x(hover)} y={y(data[hover].value)} width={width}>
          <div className="font-semibold text-ink tabular">{format(data[hover].value)}</div>
          <div className="text-ink-subtle">{data[hover].label}{data[hover].sub ? ` · ${data[hover].sub}` : ''}</div>
        </Tooltip>
      )}
      <table className="sr-only"><caption>{ariaLabel}</caption><tbody>{data.map((d) => <tr key={d.label}><th>{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </div>
  );
}

export function Sparkline({ values, className }: { values: number[]; className?: string }) {
  const w = 96, h = 28;
  const max = Math.max(...values, 1), min = Math.min(...values, 0);
  const pts = values.map((v, i) => `${((i / Math.max(1, values.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - min) / (max - min || 1)) * (h - 4)).toFixed(1)}`).join(' ');
  return <svg width={w} height={h} className={className} aria-hidden style={{ direction: 'ltr' }}><polyline points={pts} fill="none" className="stroke-accent" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

/** Part-to-whole bar for status counts. Each segment carries a label in the legend (never colour alone). */
export function StackedMeter({ parts }: { parts: { label: string; value: number; className: string; icon?: ReactNode }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0) || 1;
  return (
    <div>
      <div className="flex h-2.5 gap-[2px] rounded-full overflow-hidden bg-sunken" dir="ltr">
        {parts.filter((p) => p.value > 0).map((p) => <div key={p.label} className={p.className} style={{ width: `${(p.value / total) * 100}%` }} title={`${p.label}: ${p.value}`} />)}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-2 min-w-0">
            <span className={cx('size-2.5 rounded-sm shrink-0', p.className)} />
            <span className="text-ink-muted truncate flex items-center gap-1">{p.icon}{p.label}</span>
            <span className="ms-auto tabular text-ink font-medium">{p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
