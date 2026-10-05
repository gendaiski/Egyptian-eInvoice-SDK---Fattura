import { ArrowRight, Boxes, ChevronDown, FileInput, FileText, Layers, Menu, Receipt, X } from 'lucide-react';
import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { bi, useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Logo } from '@/components/brand';
import { IconButton, LinkButton, cx } from '@/components/ui';
import { Prefs } from '@/layouts/Shell';
import { Wrap } from './kit';

function useNav() {
  const { L } = useI18n();
  return {
    product: [
      { to: '/product', icon: <FileText />, title: L('Invoicing', 'الفواتير'), body: L('Invoices, credit and debit notes, export invoices', 'فواتير وإشعارات وفواتير تصدير') },
      { to: '/payments', icon: <Layers />, title: L('Payments & installments', 'المدفوعات والأقساط'), body: L('One payment, recurring, installment plans', 'دفعة واحدة ومتكررة وأقساط') },
      { to: '/e-receipts', icon: <Receipt />, title: L('E-receipts (POS)', 'الإيصالات الإلكترونية'), body: L('B2C receipts from your tills', 'إيصالات البيع من نقاط البيع') },
      { to: '/product#received', icon: <FileInput />, title: L('Received documents', 'المستندات الواردة'), body: L('Supplier invoices and input VAT', 'فواتير الموردين وضريبة المدخلات') },
      { to: '/developers', icon: <Boxes />, title: L('API & integrations', 'الربط والواجهات'), body: L('ERP import, REST API, signer agent', 'استيراد من ERP وواجهة برمجة') },
    ],
    resources: [
      { to: '/eta-guide', title: L('ETA e-invoicing guide', 'دليل الفاتورة الإلكترونية') },
      { to: '/security', title: L('Security', 'الأمان') },
      { to: '/status', title: L('System status', 'حالة النظام') },
      { to: '/design-system', title: L('Design system', 'نظام التصميم') },
      { to: '/about', title: L('About Fatura', 'عن فاتورة') },
    ],
  };
}

function Dropdown({ label, children, width = 'w-[520px]' }: { label: string; children: ReactNode; width?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div ref={ref} className="relative" onMouseLeave={() => setOpen(false)}>
      <button className={cx('inline-flex items-center gap-1 h-9 px-3 rounded-control text-[14px] font-medium transition-colors', open ? 'text-ink bg-sunken' : 'text-ink-muted hover:text-ink')}
        aria-expanded={open} onClick={() => setOpen((o) => !o)} onMouseEnter={() => setOpen(true)}>
        {label}<ChevronDown className={cx('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className={cx('absolute top-full start-0 pt-2 z-40', width)}><div className="card shadow-pop p-2 animate-in">{children}</div></div>}
    </div>
  );
}

export function SiteLayout() {
  const { db } = useStore();
  const { L, lang } = useI18n();
  const nav = useNav();
  const loc = useLocation();
  const [menu, setMenu] = useState(false);
  const banner = db.admin.site.banner;
  const [bannerHidden, setBannerHidden] = useState(false);

  useEffect(() => {
    setMenu(false);
    const hash = loc.hash.replace('#', '');
    if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    else window.scrollTo(0, 0);
  }, [loc.pathname, loc.hash]);

  const linkCls = ({ isActive }: { isActive: boolean }) => cx('h-9 px-3 inline-flex items-center rounded-control text-[14px] font-medium transition-colors', isActive ? 'text-ink' : 'text-ink-muted hover:text-ink');

  return (
    <div className="min-h-screen bg-canvas overflow-x-clip flex flex-col">
      <a href="#site-main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:start-2 focus:z-50 focus:bg-surface focus:px-3 focus:py-2 focus:rounded focus:border focus:border-line">{L('Skip to content', 'تخطَّ إلى المحتوى')}</a>
      {banner.on && !bannerHidden && (
        <div className={cx('text-[13px]', banner.tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-accent text-accent-on')}>
          <Wrap className="flex items-center justify-center gap-3 py-2 text-center">
            <span>{bi(lang, banner.text)}</span>
            {banner.link && <Link to={banner.link} className="font-semibold underline underline-offset-2 whitespace-nowrap">{L('Learn more', 'اعرف المزيد')}</Link>}
            <button aria-label={L('Dismiss', 'إغلاق')} className="opacity-70 hover:opacity-100" onClick={() => setBannerHidden(true)}><X className="size-4" /></button>
          </Wrap>
        </div>
      )}
      <header className="sticky top-0 z-30 bg-canvas/85 backdrop-blur border-b border-line" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <Wrap className="h-16 flex items-center gap-2">
          <Link to="/" aria-label="Fatura" className="me-4"><Logo /></Link>
          <nav className="hidden lg:flex items-center gap-0.5" aria-label={L('Main', 'الرئيسية')}>
            <Dropdown label={L('Product', 'المنتج')}>
              <div className="grid grid-cols-2 gap-1">
                {nav.product.map((p) => (
                  <Link key={p.to} to={p.to} className="flex gap-3 p-3 rounded-control hover:bg-sunken">
                    <span className="size-9 rounded-control bg-accent-soft text-accent grid place-items-center shrink-0 [&>svg]:size-[18px]">{p.icon}</span>
                    <span><span className="block font-medium text-ink text-[14px]">{p.title}</span><span className="block text-[12.5px] text-ink-muted">{p.body}</span></span>
                  </Link>
                ))}
                <Link to="/product" className="flex items-center justify-between gap-3 p-3 rounded-control bg-sunken/70 hover:bg-sunken text-[13.5px] font-medium text-accent">{L('Product overview', 'نظرة على المنتج')}<ArrowRight className="size-4 rtl:rotate-180" /></Link>
              </div>
            </Dropdown>
            <NavLink to="/solutions" className={linkCls}>{L('Solutions', 'الحلول')}</NavLink>
            <NavLink to="/pricing" className={linkCls}>{L('Pricing', 'الأسعار')}</NavLink>
            <NavLink to="/developers" className={linkCls}>{L('Developers', 'المطورون')}</NavLink>
            <Dropdown label={L('Resources', 'المصادر')} width="w-[260px]">
              <ul>{nav.resources.map((r) => <li key={r.to}><Link to={r.to} className="block px-3 py-2.5 rounded-control text-[14px] text-ink hover:bg-sunken">{r.title}</Link></li>)}</ul>
            </Dropdown>
          </nav>
          <div className="flex-1" />
          <div className="hidden sm:flex"><Prefs /></div>
          <Link to="/signin" className="hidden md:inline-flex h-9 items-center px-3 text-[14px] font-medium text-ink-muted hover:text-ink">{L('Sign in', 'تسجيل الدخول')}</Link>
          <LinkButton to="/signup" variant="primary" size="sm" className="h-9 px-4">{L('Start free', 'ابدأ مجاناً')}</LinkButton>
          <IconButton label={L('Open menu', 'فتح القائمة')} className="lg:hidden -me-2" onClick={() => setMenu(true)}><Menu className="size-5" /></IconButton>
        </Wrap>
      </header>

      {menu && (
        <div className="lg:hidden fixed inset-0 z-50 bg-canvas overflow-y-auto animate-in" role="dialog" aria-modal="true" aria-label={L('Menu', 'القائمة')}>
          <Wrap className="h-16 flex items-center justify-between"><Logo /><IconButton label={L('Close menu', 'إغلاق القائمة')} onClick={() => setMenu(false)}><X className="size-5" /></IconButton></Wrap>
          <Wrap className="pb-10">
            <div className="text-eyebrow uppercase text-ink-subtle mt-4 mb-2">{L('Product', 'المنتج')}</div>
            {nav.product.map((p) => <Link key={p.to} to={p.to} className="flex items-center gap-3 py-3 border-b border-line text-[16px] font-medium"><span className="text-accent [&>svg]:size-5">{p.icon}</span>{p.title}</Link>)}
            <div className="text-eyebrow uppercase text-ink-subtle mt-6 mb-2">{L('Company', 'الشركة')}</div>
            {[['/solutions', L('Solutions', 'الحلول')], ['/pricing', L('Pricing', 'الأسعار')], ['/developers', L('Developers', 'المطورون')], ...nav.resources.map((r) => [r.to, r.title]), ['/contact', L('Contact sales', 'تواصل مع المبيعات')]].map(([to, t]) => <Link key={to} to={to} className="block py-3 border-b border-line text-[16px] font-medium">{t}</Link>)}
            <div className="flex items-center justify-between mt-6"><Prefs /><div className="flex gap-2"><LinkButton to="/signin">{L('Sign in', 'تسجيل الدخول')}</LinkButton><LinkButton to="/signup" variant="primary">{L('Start free', 'ابدأ مجاناً')}</LinkButton></div></div>
          </Wrap>
        </div>
      )}

      <main id="site-main" className="flex-1">
        <Suspense fallback={<Wrap className="py-20"><div className="skeleton h-12 w-2/3 mb-4" /><div className="skeleton h-5 w-1/2" /></Wrap>}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="border-t border-line bg-surface">
        <Wrap className="py-14 grid gap-10 md:grid-cols-[minmax(0,1.3fr)_repeat(4,minmax(0,1fr))]">
          <div>
            <Logo />
            <p className="mt-4 text-ink-muted max-w-[34ch] text-[13.5px]">{L('E-invoicing and e-receipts for Egyptian companies, built on the ETA SDK. Arabic and English, end to end.', 'الفاتورة والإيصال الإلكتروني للشركات المصرية، مبنية على حزمة المصلحة. بالعربية والإنجليزية بالكامل.')}</p>
            <p className="mt-4 text-[12.5px] text-ink-subtle max-w-[40ch]">{L('Independent software. Not affiliated with the Egyptian Tax Authority.', 'برنامج مستقل وغير تابع لمصلحة الضرائب المصرية.')}</p>
          </div>
          {[
            [L('Product', 'المنتج'), [['/product', L('Invoicing', 'الفواتير')], ['/payments', L('Payments & installments', 'المدفوعات والأقساط')], ['/e-receipts', L('E-receipts', 'الإيصالات')], ['/pricing', L('Pricing', 'الأسعار')]]],
            [L('Solutions', 'الحلول'), [['/solutions#smes', L('SMEs', 'الشركات الصغيرة والمتوسطة')], ['/solutions#accountants', L('Accounting firms', 'مكاتب المحاسبة')], ['/solutions#retail', L('Retail & restaurants', 'التجزئة والمطاعم')], ['/solutions#exporters', L('Exporters', 'المصدّرون')]]],
            [L('Resources', 'المصادر'), [['/eta-guide', L('ETA guide', 'دليل المصلحة')], ['/developers', L('Developers', 'المطورون')], ['/status', L('Status', 'الحالة')], ['/design-system', L('Design system', 'نظام التصميم')]]],
            [L('Company', 'الشركة'), [['/about', L('About', 'عن فاتورة')], ['/security', L('Security', 'الأمان')], ['/contact', L('Contact', 'تواصل')], ['/legal/terms', L('Terms', 'الشروط')], ['/legal/privacy', L('Privacy', 'الخصوصية')]]],
          ].map(([h, links]) => (
            <div key={h as string}>
              <div className="text-eyebrow uppercase text-ink-subtle mb-3">{h as string}</div>
              <ul className="space-y-2 text-[13.5px]">{(links as string[][]).map(([to, t]) => <li key={to}><Link to={to} className="text-ink-muted hover:text-ink">{t}</Link></li>)}</ul>
            </div>
          ))}
        </Wrap>
        <Wrap className="py-5 border-t border-line flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-subtle">
          <span>© {new Date().getFullYear()} Fatura</span>
          <span className="flex items-center gap-4">
            <Link to="/app" className="hover:text-ink">{L('Open the demo workspace', 'افتح مساحة العرض')}</Link>
            <Link to="/admin" className="hover:text-ink">{L('Staff sign-in', 'دخول الموظفين')}</Link>
          </span>
        </Wrap>
      </footer>
    </div>
  );
}
