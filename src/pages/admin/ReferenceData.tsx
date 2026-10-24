import { RefreshCw } from 'lucide-react';
import { TAX_TYPES } from '@/eta/codes';
import { bi, useI18n } from '@/i18n';
import { useStore } from '@/store/store';
import { Badge, Button, Card, Mono, PageHeader, Table, Td, Th } from '@/components/ui';

export function ReferenceData() {
  const { db } = useStore();
  const { L, lang, num } = useI18n();
  return (
    <div className="animate-in">
      <PageHeader title={L('Reference data', 'البيانات المرجعية')} description={L('Bundled ETA code tables shipped with this release. Automatic sync from the live ETA SDK is not configured.', 'جداول أكواد المصلحة المضمنة في هذا الإصدار. المزامنة الفعلية غير مفعلة.')} />
      <Card pad={false} className="mb-5">
        <Table>
          <thead><tr><Th>{L('Table', 'الجدول')}</Th><Th>{L('Source', 'المصدر')}</Th><Th align="end">{L('Entries', 'العناصر')}</Th><Th>{L('Last sync', 'آخر مزامنة')}</Th><Th>{L('Status', 'الحالة')}</Th><Th /></tr></thead>
          <tbody>{db.admin.refs.map((r) => (
            <tr key={r.id}>
              <Td className="font-medium">{bi(lang, r.name)}</Td>
              <Td><Mono className="text-ink-muted">{r.source}</Mono></Td>
              <Td align="end">{num(r.count)}</Td>
              <Td className="text-ink-muted">{L('Not live synced', 'لم تتم مزامنة فعلية')}</Td>
              <Td><Badge tone="neutral">{L('Bundled', 'مضمن')}</Badge></Td>
              <Td align="end"><Button size="sm" icon={<RefreshCw className="size-3.5" />} disabled title={L('Live ETA sync is not configured', 'المزامنة الفعلية غير مفعلة')}>{L('Sync unavailable', 'المزامنة غير متاحة')}</Button></Td>
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
