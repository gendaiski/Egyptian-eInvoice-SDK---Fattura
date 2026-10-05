import clsx from 'clsx';
import { AlertTriangle, Check, CheckCircle2, CircleDashed, Copy, Info, Loader2, PenLine, X, XCircle, Ban, Undo2 } from 'lucide-react';
import {
  createContext, forwardRef, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type InputHTMLAttributes, type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import type { DocStatus } from '@/eta/types';
import { useI18n } from '@/i18n';

export const cx = clsx;

/* ---------- Button ---------- */
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet';
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; loading?: boolean }
const btnBase = 'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap rounded transition-[background,color,border,box-shadow,transform] duration-150 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none select-none';
const btnVariant: Record<Variant, string> = {
  primary: 'bg-accent text-accent-on hover:bg-accent-strong shadow-card',
  secondary: 'bg-surface text-ink border border-line hover:bg-sunken hover:border-ink-subtle/50',
  ghost: 'text-ink-muted hover:text-ink hover:bg-sunken',
  quiet: 'text-accent hover:bg-accent-soft',
  danger: 'bg-bad text-white hover:brightness-95',
};
const btnSize = { sm: 'h-8 px-2.5 text-[13px]', md: 'h-9 px-3.5 text-[13.5px]', lg: 'h-11 px-5 text-[15px]' };
export const btnClass = (variant: Variant = 'secondary', size: 'sm' | 'md' | 'lg' = 'md', extra?: string) => cx(btnBase, btnVariant[variant], btnSize[size], extra);

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, ...rest }, ref) {
  return (
    <button ref={ref} className={btnClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  );
});

export function LinkButton({ to, variant = 'secondary', size = 'md', icon, children, className }: { to: string; variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode; children: ReactNode; className?: string }) {
  return <Link to={to} className={btnClass(variant, size, className)}>{icon}{children}</Link>;
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button aria-label={label} title={label} className={cx('inline-grid place-items-center size-9 rounded text-ink-muted hover:text-ink hover:bg-sunken transition-colors', className)} {...rest}>
      {children}
    </button>
  );
}

/* ---------- Badge ---------- */
export type Tone = 'neutral' | 'ok' | 'warn' | 'bad' | 'info' | 'accent';
const toneClass: Record<Tone, string> = {
  neutral: 'bg-sunken text-ink-muted border-line',
  ok: 'bg-ok-soft text-ok border-ok/20',
  warn: 'bg-warn-soft text-warn border-warn/25',
  bad: 'bg-bad-soft text-bad border-bad/20',
  info: 'bg-info-soft text-info border-info/20',
  accent: 'bg-accent-soft text-accent border-accent/20',
};
export function Badge({ tone = 'neutral', children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return <span className={cx('inline-flex items-center gap-1 h-[22px] px-2 rounded-full border text-[12px] font-medium whitespace-nowrap', toneClass[tone], className)}>{icon}{children}</span>;
}

export function StatusBadge({ status }: { status: DocStatus }) {
  const { L } = useI18n();
  const map: Record<DocStatus, { tone: Tone; label: string; icon: ReactNode }> = {
    Draft: { tone: 'neutral', label: L('Draft', 'مسودة'), icon: <PenLine className="size-3" /> },
    Signing: { tone: 'info', label: L('Signing', 'جارٍ التوقيع'), icon: <Loader2 className="size-3 animate-spin" /> },
    Submitted: { tone: 'info', label: L('Submitted', 'مُرسلة'), icon: <CircleDashed className="size-3" /> },
    Valid: { tone: 'ok', label: L('Valid', 'صالحة'), icon: <CheckCircle2 className="size-3" /> },
    Invalid: { tone: 'bad', label: L('Invalid', 'غير صالحة'), icon: <XCircle className="size-3" /> },
    Rejected: { tone: 'warn', label: L('Rejected', 'مرفوضة'), icon: <Undo2 className="size-3" /> },
    Cancelled: { tone: 'neutral', label: L('Cancelled', 'ملغاة'), icon: <Ban className="size-3" /> },
  };
  const m = map[status];
  return <Badge tone={m.tone} icon={m.icon}>{m.label}</Badge>;
}

/* ---------- Layout bits ---------- */
export function PageHeader({ title, description, actions, back }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 mb-6">
      <div className="min-w-0">
        {back}
        <h1 className="text-[22px] sm:text-[26px] font-semibold leading-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-ink-muted max-w-[68ch]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, action, pad = true, subtitle }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; pad?: boolean }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="text-[12.5px] text-ink-subtle mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx(pad && 'px-5 pb-5', pad && !title && !action && 'pt-5')}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, delta, tone, hint, icon }: { label: string; value: ReactNode; delta?: string; tone?: 'ok' | 'bad' | 'neutral'; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="card p-4 sm:p-5">
      <div className="flex items-center justify-between text-ink-muted text-[12.5px] font-medium">
        <span>{label}</span>{icon}
      </div>
      <div className="mt-2 text-[20px] sm:text-[26px] leading-none font-semibold tabular text-ink whitespace-nowrap">{value}</div>
      <div className="mt-2 flex items-center gap-2 text-[12.5px]">
        {delta && <span className={cx('font-medium tabular', tone === 'ok' && 'text-ok', tone === 'bad' && 'text-bad', (!tone || tone === 'neutral') && 'text-ink-muted')}>{delta}</span>}
        {hint && <span className="text-ink-subtle">{hint}</span>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-14 px-6">
      <div className="size-12 rounded-full bg-sunken grid place-items-center text-ink-muted mb-4">{icon}</div>
      <h3 className="font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 text-ink-muted max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) { return <div className={cx('skeleton', className)} aria-hidden />; }

export function Callout({ tone = 'info', title, children, action, icon }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; title?: ReactNode; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  const Icon = tone === 'ok' ? CheckCircle2 : tone === 'bad' ? XCircle : tone === 'warn' ? AlertTriangle : Info;
  return (
    <div role={tone === 'bad' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-md border p-3.5', toneClass[tone])}>
      <span className="mt-0.5 shrink-0">{icon ?? <Icon className="size-[18px]" />}</span>
      <div className="min-w-0 flex-1 text-[13.5px]">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cx('text-ink-muted', title && 'mt-0.5')}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

/* ---------- Form controls ---------- */
export function Field({ label, hint, error, children, className, optional }: { label: string; hint?: ReactNode; error?: string; children: (id: string) => ReactNode; className?: string; optional?: boolean }) {
  const id = useId();
  const { L } = useI18n();
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}{optional && <span className="font-normal text-ink-subtle"> · {L('optional', 'اختياري')}</span>}</label>
      {children(id)}
      {error ? <p className="mt-1.5 text-[12.5px] text-bad">{error}</p> : hint ? <p className="mt-1.5 text-[12.5px] text-ink-subtle">{hint}</p> : null}
    </div>
  );
}
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...p }, ref) { return <input ref={ref} className={cx('input', className)} {...p} />; });
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) { return <select className={cx('input pe-8 appearance-none bg-no-repeat bg-[length:16px] bg-[position:right_.6rem_center] rtl:bg-[position:left_.6rem_center]', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23808582' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>; }
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea className={cx('input h-auto py-2 min-h-[84px]', className)} {...p} />; }

export function Switch({ checked, onChange, label, description }: { checked: boolean; onChange(v: boolean): void; label: string; description?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 cursor-pointer">
      <span><span className="block font-medium text-ink">{label}</span>{description && <span className="block text-[12.5px] text-ink-muted mt-0.5">{description}</span>}</span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={cx('relative shrink-0 mt-0.5 w-9 h-5 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <span className={cx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-[inset-inline-start]', checked ? 'start-[18px]' : 'start-0.5')} />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({ value, onChange, options, size = 'md', className }: { value: T; onChange(v: NoInfer<T>): void; options: { value: NoInfer<T>; label: ReactNode; icon?: ReactNode }[]; size?: 'sm' | 'md'; className?: string }) {
  return (
    <div role="radiogroup" className={cx('inline-flex max-w-full overflow-x-auto [scrollbar-width:none] p-0.5 rounded-md bg-sunken border border-line', className)}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(o.value)}
          className={cx('inline-flex items-center justify-center gap-1.5 rounded-[7px] font-medium transition-all flex-1 whitespace-nowrap', size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
            value === o.value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink')}>
          {o.icon}{o.label}
        </button>
      ))}
    </div>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs }: { value: T; onChange(v: NoInfer<T>): void; tabs: { value: NoInfer<T>; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line overflow-x-auto -mx-1 px-1 [scrollbar-width:none]">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)}
          className={cx('relative h-10 px-3 text-[13.5px] font-medium whitespace-nowrap transition-colors', value === t.value ? 'text-ink' : 'text-ink-muted hover:text-ink')}>
          {t.label}
          {t.count !== undefined && <span className={cx('ms-1.5 px-1.5 rounded-full text-[11.5px] tabular', value === t.value ? 'bg-accent-soft text-accent' : 'bg-sunken text-ink-subtle')}>{t.count}</span>}
          {value === t.value && <span className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

/* ---------- Table ---------- */
export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('overflow-x-auto', className)}><table className="w-full text-[13.5px] border-collapse">{children}</table></div>;
}
export const Th = ({ children, className, align }: { children?: ReactNode; className?: string; align?: 'end' }) =>
  <th className={cx('h-10 px-4 font-medium text-[12px] uppercase tracking-[.04em] text-ink-subtle bg-sunken/60 border-y border-line whitespace-nowrap', align === 'end' ? 'text-end' : 'text-start', className)}>{children}</th>;
export const Td = ({ children, className, align }: { children?: ReactNode; className?: string; align?: 'end' }) =>
  <td className={cx('px-4 py-3 border-b border-line/70 align-middle', align === 'end' && 'text-end tabular', className)}>{children}</td>;

/* ---------- Modal & drawer ---------- */
export function Modal({ open, onClose, title, children, footer, size = 'md', side }: { open: boolean; onClose(): void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'sm' | 'md' | 'lg'; side?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { L } = useI18n();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>('input,select,textarea,button:not([data-close])')?.focus(), 30);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); clearTimeout(t); document.body.style.overflow = ''; prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex animate-in" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-[rgb(10_12_12/.45)] backdrop-blur-[2px]" onClick={onClose} />
      <div ref={ref} className={cx('relative bg-surface shadow-pop flex flex-col max-h-full',
        side ? 'ms-auto h-full w-full sm:w-[520px] border-s border-line' : cx('m-auto w-[calc(100%-32px)] rounded-xl border border-line max-h-[calc(100%-48px)]', size === 'sm' ? 'max-w-[420px]' : size === 'lg' ? 'max-w-[880px]' : 'max-w-[580px]'))}>
        <header className="flex items-center justify-between gap-4 px-5 h-14 border-b border-line shrink-0">
          <h2 className="font-semibold text-[16px] text-ink truncate">{title}</h2>
          <IconButton data-close label={L('Close', 'إغلاق')} onClick={onClose}><X className="size-[18px]" /></IconButton>
        </header>
        <div className="overflow-y-auto p-5 flex-1">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 px-5 py-3.5 border-t border-line bg-sunken/40 shrink-0 rounded-b-xl">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Toasts ---------- */
interface ToastMsg { id: number; tone: 'ok' | 'bad' | 'info'; text: string; action?: { label: string; onClick(): void } }
const ToastCtx = createContext<(t: Omit<ToastMsg, 'id'>) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastMsg[]>([]);
  const push = useCallback((t: Omit<ToastMsg, 'id'>) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((y) => y.id !== id)), 4800);
  }, []);
  // Server errors reported from outside React (see lib/api reportApiError).
  useEffect(() => {
    const on = (e: Event) => push({ tone: 'bad', text: String((e as CustomEvent).detail) });
    window.addEventListener('fatura:error', on);
    return () => window.removeEventListener('fatura:error', on);
  }, [push]);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div aria-live="polite" className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 z-[60] flex flex-col gap-2 sm:w-[380px]">
        {items.map((t) => (
          <div key={t.id} className="animate-in card shadow-pop flex items-start gap-3 p-3.5">
            {t.tone === 'ok' ? <CheckCircle2 className="size-[18px] text-ok mt-px shrink-0" /> : t.tone === 'bad' ? <XCircle className="size-[18px] text-bad mt-px shrink-0" /> : <Info className="size-[18px] text-info mt-px shrink-0" />}
            <p className="flex-1 text-[13.5px] text-ink">{t.text}</p>
            {t.action && <button className="text-[13px] font-medium text-accent hover:underline" onClick={t.action.onClick}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

/* ---------- Misc ---------- */
export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  const { L } = useI18n();
  return (
    <button type="button" onClick={() => { navigator.clipboard?.writeText(value).catch(() => {}); setDone(true); setTimeout(() => setDone(false), 1400); }}
      className="inline-flex items-center gap-1 text-[12.5px] text-ink-subtle hover:text-ink transition-colors" aria-label={label ?? L('Copy', 'نسخ')}>
      {done ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      {label && <span>{done ? L('Copied', 'تم النسخ') : label}</span>}
    </button>
  );
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={cx('inline-grid place-items-center rounded-full font-semibold shrink-0 select-none', className)}
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${h} 30% 88%)`, color: `hsl(${h} 35% 28%)` }} aria-hidden>
      {initials}
    </span>
  );
}

export function Money({ value, currency = 'EGP', className, compact, muted }: { value: number; currency?: string; className?: string; compact?: boolean; muted?: boolean }) {
  const { money } = useI18n();
  return <span className={cx('tabular whitespace-nowrap', muted && 'text-ink-muted', className)}>{money(value, currency, { compact })}</span>;
}

export function Progress({ value, tone = 'accent', className }: { value: number; tone?: 'accent' | 'ok' | 'warn' | 'bad'; className?: string }) {
  const c = { accent: 'bg-accent', ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-bad' }[tone];
  return (
    <div className={cx('h-1.5 rounded-full bg-sunken overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-[width] duration-500', c)} style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
    </div>
  );
}

export function DescList({ items, cols = 2 }: { items: { k: ReactNode; v: ReactNode }[]; cols?: 1 | 2 | 3 }) {
  return (
    <dl className={cx('grid gap-x-6 gap-y-3.5', cols === 2 && 'sm:grid-cols-2', cols === 3 && 'sm:grid-cols-3')}>
      {items.map((it, i) => (
        <div key={i} className="min-w-0">
          <dt className="text-[12px] text-ink-subtle">{it.k}</dt>
          <dd className="mt-0.5 text-ink break-words">{it.v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span dir="ltr" className={cx('font-mono text-[12.5px] tracking-tight', className)}>{children}</span>;
}
