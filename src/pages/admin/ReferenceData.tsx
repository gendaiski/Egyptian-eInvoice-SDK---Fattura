import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { TAX_TYPES } from '@/eta/codes';
import { bi, useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Badge, Button, Card, Mono, PageHeader, Table, Td, Th, useToast } from '@/components/ui';

export function ReferenceData() {
  const { db, set } = useStore();
  const { L, lang, rel, num } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const sync = async (id: string) => {
    setBusy(id); await new Promise((r) => setTimeout(r, 900));
    set((x) => { const r = x.admin.refs.find((y) => y.id === id)!; r.syncedAt = new Date().toISOString(); r.status = 'ok'; });
    setBusy(null); toast({ tone: 'ok', text: L('Synced from the ETA SDK — no changes.', 'تمت المزامنة من حزمة المصلحة — لا تغييرات.') });
  };
  return (
    <div className="animate-in">
      <PageHeader title={L('Reference data', 'البيانات المرجعية')} description={L('Code tables published in the ETA SDK. Synced nightly and pushed to every tenant’s composer, so new tax subtypes and units appear without a release.', 'جداول الأكواد المنشورة في حزمة المصلحة. تُزامن ليلياً وتصل لكل الشركات دون إصدار جديد.')} />
      <Card pad={false} className="mb-5">
        <Table>
          <thead><tr><Th>{L('Table', 'الجدول')}</Th><Th>{L('Source', 'المصدر')}</Th><Th align="end">{L('Entries', 'العناصر')}</Th><Th>{L('Last sync', 'آخر مزامنة')}</Th><Th>{L('Status', 'الحالة')}</Th><Th /></tr></thead>
          <tbody>{db.admin.refs.map((r) => (
            <tr key={r.id}>
              <Td className="font-medium">{bi(lang, r.name)}</Td>
              <Td><Mono className="text-ink-muted">{r.source}</Mono></Td>
              <Td align="end">{num(r.count)}</Td>
              <Td className="text-ink-muted">{rel(r.syncedAt)}</Td>
              <Td><Badge tone={r.status === 'ok' ? 'ok' : r.status === 'stale' ? 'warn' : 'bad'}>{r.status === 'ok' ? L('Up to date', 'محدث') : r.status === 'stale' ? L('Stale', 'قديم') : L('Error', 'خطأ')}</Badge></Td>
              <Td align="end"><Button size="sm" icon={<RefreshCw className={busy === r.id ? 'size-3.5 animate-spin' : 'size-3.5'} />} onClick={() => sync(r.id)} disabled={!!busy}>{L('Sync', 'مزامنة')}</Button></Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
      <Card title={L('Tax types & subtypes (preview)', 'أنواع الضرائب (معاينة)')} pad={false}>
        <Table>
          <thead><tr><Th>{L('Code', 'الكود')}</Th><Th>{L('Tax type', 'نوع الضريبة')}</Th><Th>{L('Calculation', 'طريقة الحساب')}</Th><Th>{L('Subtypes', 'الأنواع الفرعية')}</Th></tr></thead>
          <tbody>{TAX_TYPES.map((t) => (
            <tr key={t.code}>
              <Td><Mono>{t.code}</Mono></Td>
              <Td>{bi(lang, t)}</Td>
              <Td className="text-ink-muted text-[12.5px]">{{ vat: L('Rate on net + fees + table tax', 'نسبة على الصافي + الرسوم + الجدول'), 'table-rate': L('Rate on net + fees + T3', 'نسبة على الصافي + الرسوم + T3'), 'table-fixed': L('Fixed amount', 'مبلغ ثابت'), withholding: L('Deducted: rate on net − items discount', 'تُخصم من الإجمالي'), 'taxable-fee': L('In VAT base', 'ضمن وعاء القيمة المضافة'), 'non-taxable-fee': L('Outside VAT base', 'خارج وعاء القيمة المضافة') }[t.kind]}</Td>
              <Td className="text-[12.5px]"><div className="flex flex-wrap gap-1">{t.subTypes.map((s) => <span key={s.code} title={bi(lang, s)} className="px-1.5 h-5 inline-flex items-center rounded bg-sunken border border-line font-mono text-[11px]">{s.code}</span>)}</div></Td>
            </tr>
          ))}</tbody>
        </Table>
      </Card>
    </div>
  );
}
