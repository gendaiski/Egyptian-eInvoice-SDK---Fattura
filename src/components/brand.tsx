import { cx } from './ui';

export function Logo({ className, compact, latinOnly }: { className?: string; compact?: boolean; latinOnly?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-2 font-semibold text-ink', className)}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-accent" />
        <path d="M10 8h12v3.2h-8.4v3.4h7.2v3.2h-7.2V24H10z" className="fill-accent-on" />
        <circle cx="23" cy="22" r="2.4" fill="#e3a63b" />
      </svg>
      {!compact && <span className="text-[17px] tracking-[-0.02em] whitespace-nowrap">Fatura{!latinOnly && <span className="text-ink-subtle font-normal"> · فاتورة</span>}</span>}
    </span>
  );
}
