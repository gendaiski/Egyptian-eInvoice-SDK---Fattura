import { Activity, BookOpen, Building2, CreditCard, Gauge, Layers, ScrollText, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Shell, type NavGroup } from './Shell';

export function AdminLayout() {
  const { db } = useStore();
  const { L } = useI18n();
  const pastDue = db.admin.tenants.filter((t) => t.status === 'past_due').length;
  const groups: NavGroup[] = [
    { items: [{ to: '/admin', end: true, label: L('Overview', 'نظرة عامة'), icon: <Gauge /> }] },
    {
      label: L('Customers', 'العملاء'),
      items: [
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
        { to: '/admin/settings', label: L('Platform settings', 'إعدادات المنصة'), icon: <SlidersHorizontal /> },
      ],
    },
  ];
  const palette = [
    ...groups.flatMap((g) => g.items).map((i) => ({ label: i.label, to: i.to, group: L('Page', 'صفحة') })),
    ...db.admin.tenants.map((t) => ({ label: t.name, to: `/admin/tenants/${t.id}`, group: L('Tenant', 'شركة'), keywords: `${t.rin} ${t.owner}` })),
  ];
  return <Shell admin groups={groups} palette={palette} />;
}
