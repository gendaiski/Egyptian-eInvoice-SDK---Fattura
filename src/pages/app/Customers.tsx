import { Building2, FilePlus, Globe2, PenLine, Plus, Search, User, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { docTotal, dueInfo, type Customer } from '@/store/model';
import { useStore } from '@/store/store';
import { Avatar, Button, Card, DescList, EmptyState, Input, LinkButton, Modal, Money, Mono, PageHeader, Segmented, StatusBadge, Table, Td, Th, useToast } from '@/components/ui';
import { NewCustomer } from './Composer';
import { useLabels } from './shared';

export function Customers() {
  const { db, set } = useStore();
  const { L, date } = useI18n();
  const lb = useLabels();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | 'B' | 'P' | 'F'>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const openId = params.get('open');
  const stats = useMemo(() => {
    const m = new Map<string, { billed: number; outstanding: number; count: number; last?: string }>();
    for (const d of db.docs) {
      if (!d.customerId || d.direction !== 'sent' || d.status !== 'Valid') continue;
      const s = m.get(d.customerId) ?? { billed: 0, outstanding: 0, count: 0 };
      s.billed += d.documentType === 'C' ? -docTotal(d) : docTotal(d);
      s.outstanding += dueInfo(d).outstanding; s.count++;
      if (!s.last || d.issuedAt > s.last) s.last = d.issuedAt;
      m.set(d.customerId, s);
    }
    return m;
  }, [db.docs]);
  const rows = db.customers.filter((c) => (type === 'all' || c.type === type) && (!q || `${c.name} ${c.nameAr ?? ''} ${c.taxId} ${c.email}`.toLowerCase().includes(q.toLowerCase())));
  const open = db.customers.find((c) => c.id === openId);
  const icon = { B: <Building2 className="size-3.5" />, P: <User className="size-3.5" />, F: <Globe2 className="size-3.5" /> };

  return (
    <div className="animate-in">
      <PageHeader title={L('Customers', 'العملاء')} description={L('Receivers on your ETA documents: Egyptian businesses (RIN), individuals (national ID) and foreign companies.', 'المستلمون على مستنداتك: شركات مصرية وأفراد وشركات أجنبية.')}
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setCreating(true)}>{L('New customer', 'عميل جديد')}</Button>} />
      <Card pad={false}>
        <div className="flex flex-wrap gap-2 p-4">
          <div className="relative flex-1 min-w-[220px] max-w-[340px]"><Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle" /><Input className="ps-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder={L('Name, tax ID or email', 'الاسم أو الرقم الضريبي أو البريد')} aria-label={L('Search', 'بحث')} /></div>
          <Segmented value={type} onChange={setType} options={[{ value: 'all', label: L('All', 'الكل') }, { value: 'B', label: lb.party('B') }, { value: 'P', label: lb.party('P') }, { value: 'F', label: lb.party('F') }]} />
        </div>
        {rows.length === 0 ? <EmptyState icon={<Users className="size-5" />} title={L('No customers found', 'لا يوجد عملاء')} action={<Button variant="primary" onClick={() => setCreating(true)}>{L('Add customer', 'إضافة عميل')}</Button>} /> : (
          <Table>
            <thead><tr><Th>{L('Customer', 'العميل')}</Th><Th>{L('Type', 'النوع')}</Th><Th>{L('Tax ID', 'الرقم الضريبي')}</Th><Th>{L('Last invoice', 'آخر فاتورة')}</Th><Th align="end">{L('Billed', 'إجمالي الفوترة')}</Th><Th align="end">{L('Outstanding', 'المتبقي')}</Th></tr></thead>
            <tbody>{rows.map((c) => {
              const s = stats.get(c.id);
              return (
                <tr key={c.id} className="hover:bg-sunken/50 cursor-pointer" onClick={() => setParams({ open: c.id })}>
                  <Td><div className="flex items-center gap-3 min-w-0"><Avatar name={c.name} size={30} /><div className="min-w-0"><div className="font-medium text-ink truncate max-w-[260px]">{L(c.name, c.nameAr ?? c.name)}</div><div className="text-[12px] text-ink-subtle truncate">{c.email}</div></div></div></Td>
                  <Td><span className="inline-flex items-center gap-1.5 text-ink-muted">{icon[c.type]}{lb.party(c.type)}</span></Td>
                  <Td><Mono>{c.taxId}</Mono></Td>
                  <Td className="text-ink-muted">{date(s?.last)}</Td>
                  <Td align="end"><Money value={s?.billed ?? 0} /></Td>
                  <Td align="end"><Money value={s?.outstanding ?? 0} className={s?.outstanding ? 'font-medium' : 'text-ink-subtle'} /></Td>
                </tr>
              );
            })}</tbody>
          </Table>
        )}
      </Card>

      {open && (
        <Modal side open onClose={() => setParams({})} title={L(open.name, open.nameAr ?? open.name)}
          footer={<><Button icon={<PenLine className="size-4" />} onClick={() => setEditing(open)}>{L('Edit', 'تعديل')}</Button><LinkButton variant="primary" to={`/app/documents/new${open.type === 'F' ? '?type=EI' : ''}`} icon={<FilePlus className="size-4" />}>{L('New invoice', 'فاتورة جديدة')}</LinkButton></>}>
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="rounded-md bg-sunken/60 p-3"><div className="text-[12px] text-ink-subtle">{L('Billed', 'الفوترة')}</div><Money value={stats.get(open.id)?.billed ?? 0} compact className="font-semibold text-[16px]" /></div>
            <div className="rounded-md bg-sunken/60 p-3"><div className="text-[12px] text-ink-subtle">{L('Outstanding', 'المتبقي')}</div><Money value={stats.get(open.id)?.outstanding ?? 0} compact className="font-semibold text-[16px]" /></div>
            <div className="rounded-md bg-sunken/60 p-3"><div className="text-[12px] text-ink-subtle">{L('Documents', 'المستندات')}</div><div className="font-semibold text-[16px] tabular">{stats.get(open.id)?.count ?? 0}</div></div>
          </div>
          <DescList items={[
            { k: L('Receiver type', 'نوع المستلم'), v: lb.party(open.type) },
            { k: lb.partyId(open.type), v: <Mono>{open.taxId}</Mono> },
            { k: L('Email', 'البريد'), v: open.email },
            { k: L('Phone', 'الهاتف'), v: open.phone ?? '—' },
            { k: L('Address', 'العنوان'), v: `${open.address.buildingNumber} ${open.address.street}, ${open.address.regionCity}, ${open.address.governate}, ${open.address.country}` },
            { k: L('Default terms', 'الشروط الافتراضية'), v: `${lb.terms(open.terms)} · ${open.currency}` },
          ]} />
          <h3 className="font-semibold mt-6 mb-2">{L('Recent documents', 'أحدث المستندات')}</h3>
          <ul className="divide-y divide-line border-y border-line">
            {db.docs.filter((d) => d.customerId === open.id).slice(0, 8).map((d) => (
              <li key={d.id}><Link to={`/app/documents/${d.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:bg-sunken/50 px-1">
                <span><span className="text-ink">{d.internalID}</span><span className="block text-[12px] text-ink-subtle">{date(d.issuedAt)}</span></span>
                <span className="flex items-center gap-3"><StatusBadge status={d.status} /><Money value={docTotal(d)} className="text-[13px]" /></span>
              </Link></li>
            ))}
          </ul>
        </Modal>
      )}
      {creating && <NewCustomer onClose={() => setCreating(false)} onCreate={(c) => { set((x) => { x.customers.unshift(c); }); setCreating(false); toast({ tone: 'ok', text: L('Customer added.', 'تمت إضافة العميل.') }); }} />}
      {editing && <NewCustomer initial={editing} onClose={() => setEditing(null)} onCreate={(c) => { set((x) => { const i = x.customers.findIndex((y) => y.id === c.id); x.customers[i] = c; }); setEditing(null); toast({ tone: 'ok', text: L('Customer updated.', 'تم تحديث العميل.') }); }} />}
    </div>
  );
}
