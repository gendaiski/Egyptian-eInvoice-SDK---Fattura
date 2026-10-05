import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layouts/AdminLayout';
import { AppLayout } from './layouts/AppLayout';
const Landing = lazy(() => import('./pages/Landing').then((m) => ({ default: m.Landing })));
const Onboarding = lazy(() => import('./pages/auth/Onboarding').then((m) => ({ default: m.Onboarding })));
const SignIn = lazy(() => import('./pages/auth/Auth').then((m) => ({ default: m.SignIn })));
const SignUp = lazy(() => import('./pages/auth/Auth').then((m) => ({ default: m.SignUp })));
const Dashboard = lazy(() => import('./pages/app/Dashboard').then((m) => ({ default: m.Dashboard })));
const Documents = lazy(() => import('./pages/app/Documents').then((m) => ({ default: m.Documents })));
const Composer = lazy(() => import('./pages/app/Composer').then((m) => ({ default: m.Composer })));
const DocumentDetail = lazy(() => import('./pages/app/DocumentDetail').then((m) => ({ default: m.DocumentDetail })));
const Received = lazy(() => import('./pages/app/Received').then((m) => ({ default: m.Received })));
const RecurringList = lazy(() => import('./pages/app/Recurring').then((m) => ({ default: m.RecurringList })));
const RecurringDetail = lazy(() => import('./pages/app/Recurring').then((m) => ({ default: m.RecurringDetail })));
const Receivables = lazy(() => import('./pages/app/Receivables').then((m) => ({ default: m.Receivables })));
const Customers = lazy(() => import('./pages/app/Customers').then((m) => ({ default: m.Customers })));
const Items = lazy(() => import('./pages/app/Items').then((m) => ({ default: m.Items })));
const Submissions = lazy(() => import('./pages/app/Submissions').then((m) => ({ default: m.Submissions })));
const Receipts = lazy(() => import('./pages/app/Receipts').then((m) => ({ default: m.Receipts })));
const Reports = lazy(() => import('./pages/app/Reports').then((m) => ({ default: m.Reports })));
const Settings = lazy(() => import('./pages/app/Settings').then((m) => ({ default: m.Settings })));
const AdminOverview = lazy(() => import('./pages/admin/Overview').then((m) => ({ default: m.AdminOverview })));
const Tenants = lazy(() => import('./pages/admin/Tenants').then((m) => ({ default: m.Tenants })));
const TenantDetail = lazy(() => import('./pages/admin/Tenants').then((m) => ({ default: m.TenantDetail })));
const Plans = lazy(() => import('./pages/admin/Plans').then((m) => ({ default: m.Plans })));
const Billing = lazy(() => import('./pages/admin/Billing').then((m) => ({ default: m.Billing })));
const EtaHealth = lazy(() => import('./pages/admin/EtaHealth').then((m) => ({ default: m.EtaHealth })));
const ReferenceData = lazy(() => import('./pages/admin/ReferenceData').then((m) => ({ default: m.ReferenceData })));
const AuditLog = lazy(() => import('./pages/admin/AuditLog').then((m) => ({ default: m.AuditLog })));
const AdminTeam = lazy(() => import('./pages/admin/Team').then((m) => ({ default: m.AdminTeam })));
const PlatformSettings = lazy(() => import('./pages/admin/Team').then((m) => ({ default: m.PlatformSettings })));
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));

export function App() {
  return (
    <Suspense fallback={<div className="p-10"><div className="skeleton h-8 w-64 mb-4" /><div className="skeleton h-40 w-full" /></div>}>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="documents" element={<Documents />} />
        <Route path="documents/new" element={<Composer />} />
        <Route path="documents/:id" element={<DocumentDetail />} />
        <Route path="documents/:id/edit" element={<Composer />} />
        <Route path="received" element={<Received />} />
        <Route path="recurring" element={<RecurringList />} />
        <Route path="recurring/:id" element={<RecurringDetail />} />
        <Route path="receivables" element={<Receivables />} />
        <Route path="customers" element={<Customers />} />
        <Route path="items" element={<Items />} />
        <Route path="submissions" element={<Submissions />} />
        <Route path="receipts" element={<Receipts />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Navigate to="/app/settings/company" replace />} />
        <Route path="settings/:section" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<AdminOverview />} />
        <Route path="tenants" element={<Tenants />} />
        <Route path="tenants/:id" element={<TenantDetail />} />
        <Route path="plans" element={<Plans />} />
        <Route path="billing" element={<Billing />} />
        <Route path="eta" element={<EtaHealth />} />
        <Route path="reference" element={<ReferenceData />} />
        <Route path="audit" element={<AuditLog />} />
        <Route path="team" element={<AdminTeam />} />
        <Route path="settings" element={<PlatformSettings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
  );
}
