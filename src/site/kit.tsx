import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { btnClass, cx } from '@/components/ui';

/** Page-level building blocks for the public website. Width, rhythm and type scale live here. */

export const Wrap = ({ children, className }: { children: ReactNode; className?: string }) =>
  <div className={cx('max-w-[1200px] mx-auto px-4 sm:px-6', className)}>{children}</div>;

export function Section({ children, className, tone = 'canvas', id }: { children: ReactNode; className?: string; tone?: 'canvas' | 'surface' | 'ink' | 'accent'; id?: string }) {
  const t = { canvas: '', surface: 'bg-surface border-y border-line', ink: 'bg-ink text-canvas', accent: 'bg-accent text-accent-on' }[tone];
  return <section id={id} className={cx('py-16 sm:py-24', t, className)}><Wrap>{children}</Wrap></section>;
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('text-eyebrow uppercase text-accent mb-3', className)}>{children}</div>;
}

export function SectionHead({ title, lead, eyebrow, align = 'start', className, invert }: { title: ReactNode; lead?: ReactNode; eyebrow?: ReactNode; align?: 'start' | 'center'; className?: string; invert?: boolean }) {
  return (
    <div className={cx('max-w-[720px] mb-10 sm:mb-12', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && <Eyebrow className={invert ? 'text-accent-soft' : undefined}>{eyebrow}</Eyebrow>}
      <h2 className="font-display text-title">{title}</h2>
      {lead && <p className={cx('mt-3 text-lead', invert ? 'opacity-75' : 'text-ink-muted')}>{lead}</p>}
    </div>
  );
}

export function PageHero({ title, lead, actions, aside, kicker }: { title: ReactNode; lead: ReactNode; actions?: ReactNode; aside?: ReactNode; kicker?: ReactNode }) {
  return (
    <section className="pt-12 sm:pt-20 pb-12 sm:pb-16 border-b border-line">
      <Wrap className={cx('grid gap-10 items-center', aside && 'lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]')}>
        <div>
          {kicker && <Eyebrow>{kicker}</Eyebrow>}
          <h1 className="text-display">{title}</h1>
          <p className="mt-5 text-lead text-ink-muted max-w-[56ch]">{lead}</p>
          {actions && <div className="mt-8 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {aside && <div>{aside}</div>}
      </Wrap>
    </section>
  );
}

export function Checks({ items, className }: { items: ReactNode[]; className?: string }) {
  return (
    <ul className={cx('space-y-2.5', className)}>
      {items.map((it, i) => <li key={i} className="flex gap-2.5"><Check className="size-[18px] text-ok shrink-0 mt-0.5" /><span>{it}</span></li>)}
    </ul>
  );
}

export function ArrowLink({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={cx('group inline-flex items-center gap-1.5 font-medium text-accent hover:text-accent-strong', className)}>
      {children}<ArrowRight className="size-4 rtl:rotate-180 transition-transform duration-150 group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5" />
    </Link>
  );
}

export function CtaBand({ title, lead, primary, secondary }: { title: ReactNode; lead?: ReactNode; primary: { to: string; label: string }; secondary?: { to: string; label: string } }) {
  return (
    <section className="py-16 sm:py-20">
      <Wrap>
        <div className="relative overflow-hidden rounded-sheet bg-accent text-accent-on px-6 py-12 sm:px-12 sm:py-16">
          <svg className="absolute -end-16 -bottom-20 opacity-[.12] pointer-events-none" width="360" height="360" viewBox="0 0 200 200" aria-hidden>
            <circle cx="100" cy="100" r="94" fill="none" stroke="currentColor" strokeWidth="3" /><circle cx="100" cy="100" r="56" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M78 98 l14 14 l30 -30" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="relative max-w-[640px]">
            <h2 className="font-display text-title">{title}</h2>
            {lead && <p className="mt-3 text-lead opacity-85">{lead}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={primary.to} className={btnClass('secondary', 'lg', 'bg-surface text-ink border-transparent hover:bg-canvas')}>{primary.label}</Link>
              {secondary && <Link to={secondary.to} className="inline-flex items-center justify-center h-11 px-5 rounded text-[15px] font-medium border border-accent-on/40 text-accent-on hover:bg-accent-strong transition-colors">{secondary.label}</Link>}
            </div>
          </div>
        </div>
      </Wrap>
    </section>
  );
}

export function Faq({ items }: { items: [string, string][] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map(([q, a], i) => (
        <div key={q}>
          <h3>
            <button className="w-full flex items-center justify-between gap-4 py-5 text-start text-[16px] font-medium text-ink" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
              {q}<ChevronDown className={cx('size-5 text-ink-subtle shrink-0 transition-transform duration-200', open === i && 'rotate-180')} />
            </button>
          </h3>
          {open === i && <p className="pb-5 -mt-1 text-ink-muted max-w-[68ch] animate-in">{a}</p>}
        </div>
      ))}
    </div>
  );
}

/** Bilingual counter-line: the same idea in the other language, set quietly under a headline. */
export function EchoLine({ en, ar }: { en: string; ar: string }) {
  const { lang } = useI18n();
  return <p dir={lang === 'en' ? 'rtl' : 'ltr'} lang={lang === 'en' ? 'ar' : 'en'} className="font-display text-[clamp(18px,2.2vw,26px)] text-ink-subtle mt-2">{lang === 'en' ? ar : en}</p>;
}
