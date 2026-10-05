import {
  BarChart3, Boxes, FileInput, FileText, LayoutDashboard, Plus, Receipt, Repeat, Send, Settings, Users, Wallet, Usb, Server,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { cx, LinkButton } from '@/components/ui';
import { Shell, type NavGroup, type PaletteEntry } from './Shell';

export function EnvPill() {
  const { db } = useStore();
  const { L } = useI18n();
  const prod = db.integration.env === 'production';
  return (
    <Link to="/app/settings/integration" className={cx('hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-[12px] font-medium',
      prod ? 'border-ok/25 bg-ok-soft text-ok' : 'border-warn/30 bg-warn-soft text-warn')} title={L('ETA environment', 'بيئة المصلحة')}>
      <Server className="size-3.5" />{prod ? L('ETA production', 'إنتاج المصلحة') : db.integration.env === 'simulator' ? L('ETA simulator', 'محاكي المصلحة') : L('ETA pre-production', 'بيئة الاختبار')}
    </Link>
  );
}

function SignerPill() {
  const { db } = useStore();
  const { L } = useI18n();
  const cert = db.signing.method === 'test-certificate';
  const on = cert || db.signing.agent.status === 'online';
  return (
    <Link to="/app/settings/signing" className="hidden md:inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border border-line bg-surface text-[12px] font-medium text-ink-muted hover:text-ink"
      title={L('Signing agent', 'وكيل التوقيع')}>
      <Usb className="size-3.5" />
      <span className={cx('size-1.5 rounded-full', on ? 'bg-ok' : 'bg-bad')} />
      {cert ? L('Test certificate', 'شهادة اختبار') : on ? L('Signer online', 'التوقيع متصل') : L('Signer offline', 'التوقيع غير متصل')}
    </Link>
  );
}

export function AppLayout() {
  const { db } = useStore();
  const { L } = useI18n();
  const invalid = db.docs.filter((d) => d.direction === 'sent' && d.status === 'Invalid').length;
  const inbox = db.docs.filter((d) => d.direction === 'received' && d.pending).length;

  const groups: NavGroup[] = [
    { items: [{ to: '/app', end: true, label: L('Dashboard', 'لوحة التحكم'), icon: <LayoutDashboard /> }] },
    {
      label: L('Sales', 'المبيعات'),
      items: [
        { to: '/app/documents', label: L('Invoices & notes', 'الفواتير والإشعارات'), icon: <FileText />, badge: invalid },
        { to: '/app/recurring', label: L('Recurring', 'الفواتير المتكررة'), icon: <Repeat /> },
        { to: '/app/receivables', label: L('Payments & installments', 'المدفوعات والأقساط'), icon: <Wallet /> },
        { to: '/app/customers', label: L('Customers', 'العملاء'), icon: <Users /> },
      ],
    },
    { label: L('Purchases', 'المشتريات'), items: [{ to: '/app/received', label: L('Received documents', 'المستندات الواردة'), icon: <FileInput />, badge: inbox }] },
    {
      label: L('Compliance', 'الامتثال'),
      items: [
        { to: '/app/items', label: L('Items & codes', 'الأصناف والأكواد'), icon: <Boxes /> },
        { to: '/app/submissions', label: L('Submissions log', 'سجل الإرسال'), icon: <Send /> },
        { to: '/app/receipts', label: L('E-receipts (POS)', 'الإيصالات الإلكترونية'), icon: <Receipt /> },
        { to: '/app/reports', label: L('Tax reports', 'التقارير الضريبية'), icon: <BarChart3 /> },
      ],
    },
    { items: [{ to: '/app/settings', label: L('Settings', 'الإعدادات'), icon: <Settings /> }] },
  ];

  const palette = useMemo<PaletteEntry[]>(() => {
    const pages = groups.flatMap((g) => g.items).map((i) => ({ label: i.label, to: i.to, group: L('Page', 'صفحة') }));
    const actions = [
      { label: L('New invoice', 'فاتورة جديدة'), to: '/app/documents/new', group: L('Action', 'إجراء'), keywords: 'create' },
      { label: L('New credit note', 'إشعار دائن جديد'), to: '/app/documents/new?type=C', group: L('Action', 'إجراء') },
      { label: L('New export invoice', 'فاتورة تصدير جديدة'), to: '/app/documents/new?type=EI', group: L('Action', 'إجراء') },
      { label: L('ETA connection', 'الربط مع المصلحة'), to: '/app/settings/integration', group: L('Settings', 'الإعدادات'), keywords: 'client id secret' },
    ];
    const docs = db.docs.slice(0, 200).map((d) => ({ label: `${d.internalID} · ${d.counterparty.name ?? ''}`, to: `/app/documents/${d.id}`, group: L('Document', 'مستند'), keywords: d.uuid }));
    const customers = db.customers.map((c) => ({ label: c.name, to: `/app/customers?open=${c.id}`, group: L('Customer', 'عميل'), keywords: `${c.taxId} ${c.nameAr ?? ''}` }));
    return [...actions, ...pages, ...docs, ...customers];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.docs, db.customers, L]);

  if (!db.session.signedIn) return <Navigate to="/signin" replace />;
  if (db.session.staffRole && !db.session.tenantId) return <Navigate to="/admin" replace />;
  if (!db.session.onboarded) return <Navigate to="/onboarding" replace />;

  return (
    <Shell
      groups={groups}
      palette={palette}
      sidebarHeader={<div className="px-3 pb-2"><LinkButton to="/app/documents/new" variant="primary" className="w-full" icon={<Plus className="size-4" />}>{L('New invoice', 'فاتورة جديدة')}</LinkButton></div>}
      sidebarFooter={
        <div className="m-3 p-3 rounded-md bg-sunken border border-line">
          <div className="text-[12px] text-ink-subtle">{L('Taxpayer', 'الممول')}</div>
          <div className="font-medium text-ink text-[13.5px] truncate">{L(db.company.name, db.company.nameAr)}</div>
          <div className="font-mono text-[12px] text-ink-muted mt-0.5" dir="ltr">RIN {db.company.rin}</div>
        </div>
      }
      topbarStart={<div className="flex items-center gap-2 me-1"><EnvPill /><SignerPill /></div>}
    />
  );
}
