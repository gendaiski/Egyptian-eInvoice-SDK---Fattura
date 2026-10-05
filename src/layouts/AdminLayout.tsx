import { Activity, BookOpen, Building2, CreditCard, Gauge, Globe, Inbox, Layers, ScrollText, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Navigate } from 'react-router-dom';
import { Shell, type NavGroup } from './Shell';

export function AdminLayout() {
  const { db, mode } = useStore();
  const { L } = useI18n();
  const pastDue = db.admin.tenants.filter((t) => t.status === 'past_due').length;
  const groups: NavGroup[] = [
    { items: [{ to: '/admin', end: true, label: L('Overview', 'نظرة عامة'), icon: <Gauge /> }] },
    {
      label: L('Customers', 'العملاء'),
      items: [
        { to: '/admin/leads', label: L('Leads', 'العملاء المحتملون'), icon: <Inbox />, badge: db.admin.leads.filter((l) => l.status === 'new').length },
        { to: '/admin/tenants', label: L('Tenants', 'الشركات المشتركة'), icon: <Building2 /> },
        { to: '/admin/billing', label: L('Billing & collections', 'الفوترة والتحصيل'), icon: <CreditCard />, badge: pastDue },
        { to: '/admin/plans', label: L('Plans & pricing', 'الباقات والأسعار'), icon: <Layers /> },
      ],
    },
    {
      label: L('Platform', 'المنصة'),
      items: [
        { to: '/admin/eta', label: L('ETA integration health', 'صحة الربط مع المصلحة'), icon: <Activity /> },
        { to: '/admin/reference', label: L('Reference data', 'البيانات المرجعية'), icon: <BookOpen /> },
        { to: '/admin/audit', label: L('Audit log', 'سجل التدقيق'), icon: <ScrollText /> },
      ],
    },
    {
      label: L('Access', 'الصلاحيات'),
      items: [
        { to: '/admin/team', label: L('Admin team & roles', 'فريق الإدارة والأدوار'), icon: <ShieldCheck /> },
        { to: '/admin/settings', label: L('Platform & website', 'المنصة والموقع'), icon: <SlidersHorizontal /> },
        { to: '/', end: true, label: L('View website', 'عرض الموقع'), icon: <Globe /> },
      ],
    },
  ];
  const palette = [
    ...groups.flatMap((g) => g.items).map((i) => ({ label: i.label, to: i.to, group: L('Page', 'صفحة') })),
    ...db.admin.tenants.map((t) => ({ label: t.name, to: `/admin/tenants/${t.id}`, group: L('Tenant', 'شركة'), keywords: `${t.rin} ${t.owner}` })),
  ];
  if (mode === 'api' && !db.session.signedIn) return <Navigate to="/signin" replace />;
  if (mode === 'api' && !db.session.staffRole) return <Navigate to="/app" replace />;
  return <Shell admin groups={groups} palette={palette} />;
}
