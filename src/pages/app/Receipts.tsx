import { MonitorSmartphone, Receipt as ReceiptIcon } from 'lucide-react';
import { useState } from 'react';
import { bi, useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Badge, Card, DescList, EmptyState, Modal, Money, Mono, PageHeader, Stat, Table, Td, Th, type Tone } from '@/components/ui';
import type { Receipt } from '@/store/model';

export function Receipts() {
  const { db } = useStore();
  const { L, lang, date } = useI18n();
  const [open, setOpen] = useState<Receipt | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const todays = db.receipts.filter((r) => r.at.slice(0, 10) === today);
  const devices = [...new Set(db.receipts.map((r) => r.device))];
  const tone: Record<string, Tone> = { Valid: 'ok', Invalid: 'bad', Submitted: 'info' };
  const method = { C: L('Cash', 'نقدي'), V: L('Visa / card', 'فيزا'), W: L('Wallet', 'محفظة') };
  return (
    <div className="animate-in">
      <PageHeader title={L('E-receipts (POS)', 'الإيصالات الإلكترونية')} description={L('B2C receipts from your registered POS devices, submitted in real time with the e-receipt API (receipt v1.2).', 'إيصالات البيع للمستهلكين من أجهزة نقاط البيع المسجلة.')} />
      <div className="grid gap-3 grid-cols-2 xl:grid-cols-4 mb-5">
        <Stat label={L('Receipts today', 'إيصالات اليوم')} value={todays.length} />
        <Stat label={L('Sales today', 'مبيعات اليوم')} value={<Money value={todays.reduce((s, r) => s + (r.type === 'R' ? -r.total : r.total), 0)} compact />} />
        <Stat label={L('Registered devices', 'الأجهزة المسجلة')} value={devices.length} icon={<MonitorSmartphone className="size-4" />} />
        <Stat label={L('Invalid (7 days)', 'غير صالحة (٧ أيام)')} value={db.receipts.filter((r) => r.status === 'Invalid').length} tone="bad" />
      </div>
      <Card pad={false}>
        {db.receipts.length === 0 ? <EmptyState icon={<ReceiptIcon className="size-5" />} title={L('No receipts yet', 'لا توجد إيصالات')} /> : (
          <Table>
            <thead><tr><Th>{L('Receipt', 'الإيصال')}</Th><Th>{L('Time', 'الوقت')}</Th><Th>{L('Device', 'الجهاز')}</Th><Th>{L('Payment', 'الدفع')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('VAT', 'الضريبة')}</Th><Th align="end">{L('Total', 'الإجمالي')}</Th></tr></thead>
            <tbody>{db.receipts.map((r) => (
              <tr key={r.id} className="hover:bg-sunken/50 cursor-pointer" onClick={() => setOpen(r)}>
                <Td><span className="font-medium text-ink">{r.number}</span>{r.type === 'R' && <Badge tone="warn" className="ms-2">{L('Return', 'مرتجع')}</Badge>}</Td>
                <Td className="text-ink-muted whitespace-nowrap">{date(r.at, 'datetime')}</Td>
                <Td><Mono>{r.device}</Mono></Td>
                <Td>{method[r.method]}</Td>
                <Td><Badge tone={tone[r.status]}>{r.status}</Badge></Td>
                <Td align="end"><Money value={r.vat} muted /></Td>
                <Td align="end"><Money value={r.type === 'R' ? -r.total : r.total} className="font-medium" /></Td>
              </tr>
            ))}</tbody>
          </Table>
        )}
      </Card>
      {open && (
        <Modal open onClose={() => setOpen(null)} title={open.number}>
          <DescList items={[
            { k: L('Receipt type', 'نوع الإيصال'), v: open.type === 'S' ? L('Sale (s)', 'بيع') : L('Return (r)', 'مرتجع') },
            { k: L('Branch', 'الفرع'), v: bi(lang, (() => { const b = db.company.branches.find((x) => x.id === open.branchId)!; return { en: b.name, ar: b.nameAr }; })()) },
            { k: L('Device serial', 'رقم الجهاز'), v: <Mono>{open.device}</Mono> },
            { k: L('Buyer', 'المشتري'), v: open.buyerType === 'P' ? L('Individual', 'فرد') : open.buyerType },
            { k: L('Total', 'الإجمالي'), v: <Money value={open.total} /> },
            { k: L('VAT included', 'الضريبة المشمولة'), v: <Money value={open.vat} /> },
          ]} />
          <div className="mt-4"><div className="text-[12px] text-ink-subtle">{L('Receipt UUID (SHA-256 of the serialized receipt, chained to the previous one)', 'معرّف الإيصال (SHA-256 مرتبط بالإيصال السابق)')}</div><Mono className="break-all">{open.uuid}</Mono></div>
        </Modal>
      )}
    </div>
  );
}
