import { Inbox, Mail, Search } from 'lucide-react';
import { useState } from 'react';
import { bi, useI18n } from '@/i18n';
import type { Lead } from '@/store/model';
import { useStore } from '@/store/store';
import { Badge, CopyButton, DescList, EmptyState, Input, Modal, PageHeader, Select, Stat, Table, Tabs, Td, Th, useToast, type Tone } from '@/components/ui';

export function Leads() {
  const { db, set } = useStore();
  const { L, lang, rel, date } = useI18n();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | Lead['status']>('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Lead | null>(null);
  const leads = db.admin.leads;
  const rows = leads.filter((l) => (tab === 'all' || l.status === tab) && (!q || `${l.name} ${l.company} ${l.email}`.toLowerCase().includes(q.toLowerCase())));
  const tone: Record<Lead['status'], Tone> = { new: 'info', contacted: 'warn', qualified: 'accent', won: 'ok', lost: 'neutral' };
  const statusLabel: Record<Lead['status'], string> = { new: L('New', 'جديد'), contacted: L('Contacted', 'تم التواصل'), qualified: L('Qualified', 'مؤهل'), won: L('Won', 'تم الفوز'), lost: L('Lost', 'خسارة') };
  const topic: Record<Lead['topic'], string> = { demo: L('Demo', 'عرض'), sales: L('Sales', 'مبيعات'), partnership: L('Partnership', 'شراكة'), support: L('Go-live help', 'مساعدة التشغيل') };
  const source: Record<Lead['source'], string> = { contact: L('Contact form', 'نموذج التواصل'), pricing: L('Pricing page', 'صفحة الأسعار'), signup: L('Trial sign-up', 'تسجيل تجريبي'), guide: L('ETA guide', 'دليل المصلحة') };
  const setStatus = (id: string, s: Lead['status']) => { set((x) => { x.admin.leads.find((l) => l.id === id)!.status = s; }); setOpen((o) => (o && o.id === id ? { ...o, status: s } : o)); };
  const plan = (id?: string) => db.admin.plans.find((p) => p.id === id);
  return (
    <div className="animate-in">
      <PageHeader title={L('Leads', 'العملاء المحتملون')} description={L('Everything the website sends in: contact and demo requests, pricing enquiries and trial sign-ups.', 'كل ما يرسله الموقع: طلبات التواصل والعروض واستفسارات الأسعار والتسجيلات التجريبية.')} />
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 mb-5">
        <Stat label={L('New', 'جديد')} value={leads.filter((l) => l.status === 'new').length} />
        <Stat label={L('In progress', 'قيد المتابعة')} value={leads.filter((l) => l.status === 'contacted' || l.status === 'qualified').length} />
        <Stat label={L('Trial sign-ups', 'تسجيلات تجريبية')} value={leads.filter((l) => l.source === 'signup').length} />
        <Stat label={L('Won', 'تم الفوز')} value={leads.filter((l) => l.status === 'won').length} tone="ok" />
      </div>
      <div className="card">
        <div className="px-4 pt-2"><Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: L('All', 'الكل'), count: leads.length }, ...(['new', 'contacted', 'qualified', 'won', 'lost'] as const).map((s) => ({ value: s, label: statusLabel[s], count: leads.filter((l) => l.status === s).length }))]} /></div>
        <div className="p-4"><div className="relative max-w-[340px]"><Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Name, company or email', 'الاسم أو الشركة أو البريد')} aria-label={L('Search', 'بحث')} /></div></div>
        {rows.length === 0 ? <EmptyState icon={<Inbox className="size-5" />} title={L('No leads here', 'لا يوجد عملاء محتملون')} body={L('Requests from the website contact form and sign-ups appear here.', 'تظهر هنا طلبات نموذج التواصل والتسجيلات.')} /> : (
          <Table>
            <thead><tr><Th>{L('Who', 'من')}</Th><Th>{L('Topic', 'الموضوع')}</Th><Th>{L('Source', 'المصدر')}</Th><Th>{L('Interest', 'الاهتمام')}</Th><Th>{L('Received', 'الاستلام')}</Th><Th>{L('Status', 'الحالة')}</Th></tr></thead>
            <tbody>{rows.map((l) => (
              <tr key={l.id} className="hover:bg-sunken/50 cursor-pointer" onClick={() => setOpen(l)}>
                <Td><div className="font-medium text-ink">{l.name}</div><div className="text-[12px] text-ink-subtle">{l.company}</div></Td>
                <Td>{topic[l.topic]}</Td>
                <Td className="text-ink-muted">{source[l.source]}</Td>
                <Td className="text-[13px] text-ink-muted">{plan(l.planId) ? `${bi(lang, { en: plan(l.planId)!.name, ar: plan(l.planId)!.nameAr })}${l.billing ? ` · ${l.billing}` : ''}` : l.docsPerMonth ? L(`${l.docsPerMonth} docs/mo`, `${l.docsPerMonth} مستند/شهر`) : '—'}</Td>
                <Td className="text-ink-muted whitespace-nowrap">{rel(l.at)}</Td>
                <Td><Badge tone={tone[l.status]}>{statusLabel[l.status]}</Badge></Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </div>
      {open && (
        <Modal side open onClose={() => setOpen(null)} title={`${open.name} · ${open.company}`}>
          <DescList items={[
            { k: L('Email', 'البريد'), v: <span className="flex items-center gap-2" dir="ltr"><Mail className="size-4 text-ink-subtle" />{open.email}<CopyButton value={open.email} /></span> },
            { k: L('Phone', 'الهاتف'), v: open.phone ?? '—' },
            { k: L('Topic', 'الموضوع'), v: topic[open.topic] },
            { k: L('Source', 'المصدر'), v: source[open.source] },
            { k: L('Plan interest', 'الباقة'), v: plan(open.planId)?.name ?? '—' },
            { k: L('Received', 'الاستلام'), v: date(open.at, 'datetime') },
          ]} />
          <div className="mt-5 rounded-card bg-sunken/60 border border-line p-4 text-[14px] whitespace-pre-wrap">{open.message}</div>
          <div className="mt-5"><span className="label">{L('Status', 'الحالة')}</span><Select value={open.status} onChange={(e) => { setStatus(open.id, e.target.value as Lead['status']); toast({ tone: 'ok', text: L('Lead updated.', 'تم تحديث العميل المحتمل.') }); }}>{(['new', 'contacted', 'qualified', 'won', 'lost'] as const).map((s) => <option key={s} value={s}>{statusLabel[s]}</option>)}</Select></div>
        </Modal>
      )}
    </div>
  );
}
