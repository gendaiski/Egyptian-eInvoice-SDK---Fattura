import { Bell, ChevronDown, Command, Languages, LogOut, Menu, Moon, Search, Shield, Sun, X, ArrowLeftRight } from 'lucide-react';
import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useActions, useStore } from '@/store/store';
import { Logo } from '@/components/brand';
import { Avatar, Badge, IconButton, cx } from '@/components/ui';

export interface NavItem { to: string; label: string; icon: ReactNode; badge?: number; end?: boolean }
export interface NavGroup { label?: string; items: NavItem[] }

function Sidebar({ groups, header, footer, onNavigate }: { groups: NavGroup[]; header?: ReactNode; footer?: ReactNode; onNavigate?(): void }) {
  return (
    <div className="flex flex-col h-full">
      {header}
      <nav className="flex-1 overflow-y-auto px-3 pb-4" aria-label="Main">
        {groups.map((g, i) => (
          <div key={i} className="mt-4 first:mt-1">
            {g.label && <div className="px-2.5 mb-1 text-[11px] font-semibold uppercase tracking-[.08em] text-ink-subtle">{g.label}</div>}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink to={it.to} end={it.end} onClick={onNavigate}
                    className={({ isActive }) => cx('group flex items-center gap-2.5 h-9 px-2.5 rounded text-[13.5px] font-medium transition-colors',
                      isActive ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:text-ink hover:bg-sunken')}>
                    <span className="[&>svg]:size-[17px] shrink-0">{it.icon}</span>
                    <span className="truncate">{it.label}</span>
                    {!!it.badge && <span className="ms-auto min-w-5 h-5 px-1.5 rounded-full bg-bad text-white text-[11px] grid place-items-center tabular">{it.badge}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {footer}
    </div>
  );
}

function Popover({ open, onClose, children, className }: { open: boolean; onClose(): void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className={cx('absolute top-full mt-2 end-0 z-40 card shadow-pop animate-in', className)}>{children}</div>;
}

export function Prefs() {
  const { lang, setLang, theme, setTheme, L } = useI18n();
  return (
    <>
      <IconButton label={L('العربية', 'English')} onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}>
        <span className="sr-only">{L('Switch language', 'تغيير اللغة')}</span>
        {lang === 'en' ? <span className="text-[15px] font-semibold leading-none" style={{ fontFamily: 'IBM Plex Sans Arabic' }}>ع</span> : <Languages className="size-[18px]" />}
      </IconButton>
      <IconButton label={theme === 'dark' ? L('Light mode', 'الوضع الفاتح') : L('Dark mode', 'الوضع الداكن')} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
        {theme === 'dark' ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </IconButton>
    </>
  );
}

function Notifications() {
  const { db } = useStore();
  const { markAllRead } = useActions();
  const { L, lang, rel } = useI18n();
  const [open, setOpen] = useState(false);
  const unread = db.notices.filter((n) => !n.read).length;
  const nav = useNavigate();
  const dot = { ok: 'bg-ok', bad: 'bg-bad', warn: 'bg-warn', info: 'bg-info' };
  return (
    <div className="relative">
      <IconButton label={L('Notifications', 'الإشعارات')} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <Bell className="size-[18px]" />
        {unread > 0 && <span className="absolute top-1.5 end-1.5 size-2 rounded-full bg-bad ring-2 ring-surface" />}
      </IconButton>
      <Popover open={open} onClose={() => setOpen(false)} className="w-[min(380px,calc(100vw-24px))]">
        <div className="flex items-center justify-between px-4 h-12 border-b border-line">
          <span className="font-semibold">{L('Notifications', 'الإشعارات')}</span>
          {unread > 0 && <button className="text-[12.5px] link" onClick={markAllRead}>{L('Mark all read', 'تعليم الكل كمقروء')}</button>}
        </div>
        <ul className="max-h-[360px] overflow-y-auto">
          {db.notices.slice(0, 12).map((n) => (
            <li key={n.id}>
              <button className="w-full text-start flex gap-3 px-4 py-3 hover:bg-sunken border-b border-line/60" onClick={() => { setOpen(false); if (n.to) nav(n.to); }}>
                <span className={cx('mt-1.5 size-2 rounded-full shrink-0', n.read ? 'bg-line' : dot[n.tone])} />
                <span className="flex-1 min-w-0">
                  <span className={cx('block text-[13.5px]', n.read ? 'text-ink-muted' : 'text-ink')}>{n.text[lang]}</span>
                  <span className="block text-[12px] text-ink-subtle mt-0.5">{rel(n.at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Popover>
    </div>
  );
}

function UserMenu({ admin }: { admin?: boolean }) {
  const { db, set } = useStore();
  const { L } = useI18n();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const user = admin ? db.admin.users[0] : db.session.user;
  return (
    <div className="relative">
      <button className="flex items-center gap-2 h-9 ps-1 pe-2 rounded hover:bg-sunken" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu">
        <Avatar name={user.name} size={28} />
        <span className="hidden lg:block text-[13px] font-medium text-ink">{user.name}</span>
        <ChevronDown className="size-4 text-ink-subtle hidden lg:block" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} className="w-64 py-1.5">
        <div className="px-3.5 py-2 border-b border-line mb-1">
          <div className="font-medium text-ink">{user.name}</div>
          <div className="text-[12.5px] text-ink-subtle truncate">{user.email}</div>
        </div>
        <Link to={admin ? '/app' : '/admin'} onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-3.5 h-9 text-[13.5px] hover:bg-sunken">
          {admin ? <ArrowLeftRight className="size-4 text-ink-muted" /> : <Shield className="size-4 text-ink-muted" />}
          {admin ? L('Open taxpayer workspace', 'فتح مساحة الممول') : L('Fatura admin panel', 'لوحة إدارة فاتورة')}
        </Link>
        <button onClick={() => { set((x) => { x.session.signedIn = false; }); nav('/signin'); }} className="w-full flex items-center gap-2.5 px-3.5 h-9 text-[13.5px] hover:bg-sunken">
          <LogOut className="size-4 text-ink-muted" />{L('Sign out', 'تسجيل الخروج')}
        </button>
      </Popover>
    </div>
  );
}

export interface PaletteEntry { label: string; to: string; group: string; keywords?: string }

function CommandPalette({ open, onClose, entries }: { open: boolean; onClose(): void; entries: PaletteEntry[] }) {
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const { L } = useI18n();
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? entries.filter((e) => `${e.label} ${e.keywords ?? ''}`.toLowerCase().includes(s)) : entries).slice(0, 9);
  }, [q, entries]);
  useEffect(() => { if (open) { setQ(''); setI(0); } }, [open]);
  if (!open) return null;
  const go = (e: PaletteEntry) => { onClose(); nav(e.to); };
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 animate-in" role="dialog" aria-modal="true" aria-label={L('Search', 'بحث')}>
      <div className="absolute inset-0 bg-[rgb(10_12_12/.45)]" onClick={onClose} />
      <div className="relative w-full max-w-[560px] card shadow-pop overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-line">
          <Search className="size-[18px] text-ink-subtle" />
          <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setI(0); }} placeholder={L('Search documents, customers, pages…', 'ابحث في المستندات والعملاء والصفحات…')}
            className="flex-1 bg-transparent outline-none text-[15px] text-ink placeholder:text-ink-subtle"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter' && results[i]) go(results[i]);
              if (e.key === 'Escape') onClose();
            }} />
          <span className="kbd">Esc</span>
        </div>
        <ul className="max-h-[50vh] overflow-y-auto py-1.5">
          {results.length === 0 && <li className="px-4 py-8 text-center text-ink-muted">{L('No matches', 'لا توجد نتائج')}</li>}
          {results.map((r, k) => (
            <li key={r.to + r.label}>
              <button onMouseEnter={() => setI(k)} onClick={() => go(r)} className={cx('w-full flex items-center justify-between gap-3 px-4 h-10 text-start text-[13.5px]', k === i && 'bg-sunken')}>
                <span className="truncate text-ink">{r.label}</span>
                <span className="text-[12px] text-ink-subtle shrink-0">{r.group}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Shell({ groups, sidebarHeader, sidebarFooter, topbarStart, palette, admin }: {
  groups: NavGroup[]; sidebarHeader?: ReactNode; sidebarFooter?: ReactNode; topbarStart?: ReactNode; palette: PaletteEntry[]; admin?: boolean;
}) {
  const [mobile, setMobile] = useState(false);
  const [cmd, setCmd] = useState(false);
  const { L } = useI18n();
  const loc = useLocation();
  useEffect(() => { setMobile(false); window.scrollTo(0, 0); }, [loc.pathname]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmd((c) => !c); } };
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, []);

  const brand = (
    <div className="flex items-center justify-between h-16 px-5 shrink-0">
      <Link to={admin ? '/admin' : '/app'} aria-label="Fatura"><Logo latinOnly={admin} /></Link>
      {admin && <Badge tone="accent">{L('Admin', 'الإدارة')}</Badge>}
    </div>
  );

  return (
    <div className="min-h-screen">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:rounded focus:border focus:border-line">{L('Skip to content', 'تخطَّ إلى المحتوى')}</a>
      <aside className="hidden lg:block fixed inset-y-0 start-0 w-[248px] border-e border-line bg-surface z-30">
        <Sidebar groups={groups} header={<>{brand}{sidebarHeader}</>} footer={sidebarFooter} />
      </aside>
      {mobile && (
        <div className="lg:hidden fixed inset-0 z-50 animate-in">
          <div className="absolute inset-0 bg-[rgb(10_12_12/.45)]" onClick={() => setMobile(false)} />
          <aside className="absolute inset-y-0 start-0 w-[280px] bg-surface border-e border-line shadow-pop">
            <IconButton label={L('Close menu', 'إغلاق القائمة')} className="absolute top-3.5 end-3" onClick={() => setMobile(false)}><X className="size-5" /></IconButton>
            <Sidebar groups={groups} header={<>{brand}{sidebarHeader}</>} footer={sidebarFooter} onNavigate={() => setMobile(false)} />
          </aside>
        </div>
      )}
      <div className="lg:ps-[248px]">
        <header className="sticky top-0 z-20 h-16 bg-canvas/85 backdrop-blur border-b border-line">
          <div className="h-full max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-2">
            <IconButton label={L('Open menu', 'فتح القائمة')} className="lg:hidden -ms-2" onClick={() => setMobile(true)}><Menu className="size-5" /></IconButton>
            <button onClick={() => setCmd(true)} className="flex items-center gap-2.5 h-9 px-3 rounded border border-line bg-surface text-ink-subtle hover:border-ink-subtle/50 w-full max-w-[340px] text-[13.5px]">
              <Search className="size-4" /><span className="truncate">{L('Search…', 'بحث…')}</span>
              <span className="ms-auto hidden sm:inline-flex items-center gap-0.5 kbd"><Command className="size-3" />K</span>
            </button>
            <div className="flex-1" />
            {topbarStart}
            <Prefs />
            {!admin && <Notifications />}
            <UserMenu admin={admin} />
          </div>
        </header>
        <main id="main" className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <Suspense fallback={<div aria-busy="true"><div className="skeleton h-8 w-72 mb-3" /><div className="skeleton h-4 w-96 mb-8" /><div className="grid gap-3 grid-cols-2 xl:grid-cols-4 mb-6">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28" />)}</div><div className="skeleton h-72" /></div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <CommandPalette open={cmd} onClose={() => setCmd(false)} entries={palette} />
    </div>
  );
}
