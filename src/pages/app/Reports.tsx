import { Download, FileArchive } from 'lucide-react';
import { useMemo, useState } from 'react';
import { taxType } from '@/eta/codes';
import { bi, useI18n } from '@/i18n';
import { computeDoc } from '@/store/model';
import { useStore } from '@/store/store';
import { Button, Callout, Card, Money, PageHeader, Select, Table, Td, Th, useToast } from '@/components/ui';

export function Reports() {
  const { db } = useStore();
  const { L, lang } = useI18n();
  const toast = useToast();
  const months = useMemo(() => Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setUTCDate(15); d.setUTCMonth(d.getUTCMonth() - i); return d.toISOString().slice(0, 7); }), []);
  const [month, setMonth] = useState(months[1]);
  const fmtMonth = (m: string) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', { month: 'long', year: 'numeric' }).format(new Date(`${m}-15`));

  const report = useMemo(() => {
    const inMonth = db.docs.filter((d) => d.status === 'Valid' && d.issuedAt.startsWith(month));
    const agg = (dir: 'sent' | 'received') => {
      const byType = new Map<string, { base: number; tax: number }>();
      let net = 0;
      for (const d of inMonth.filter((x) => x.direction === dir)) {
        const sign = d.documentType === 'C' ? -1 : 1;
        const { lines } = computeDoc(d);
        for (const l of lines) {
          net += sign * l.netTotal;
          for (const t of l.taxableItems) {
            const k = `${t.taxType}|${t.subType}`;
            const cur = byType.get(k) ?? { base: 0, tax: 0 };
            cur.base += sign * l.netTotal; cur.tax += sign * t.amount;
            byType.set(k, cur);
          }
        }
      }
      return { net, rows: [...byType.entries()].map(([k, v]) => ({ taxType: k.split('|')[0], subType: k.split('|')[1], ...v })).sort((a, b) => a.taxType.localeCompare(b.taxType, undefined, { numeric: true })) };
    };
    const out = agg('sent'), inp = agg('received');
    const vat = (r: typeof out) => r.rows.filter((x) => x.taxType === 'T1').reduce((s, x) => s + x.tax, 0);
    const wht = out.rows.filter((x) => x.taxType === 'T4').reduce((s, x) => s + x.tax, 0);
    return { out, inp, outVat: vat(out), inVat: vat(inp), wht, count: inMonth.length };
  }, [db.docs, month]);

  const label = (code: string, sub: string) => { const t = taxType(code); const s = t?.subTypes.find((x) => x.code === sub); return `${code} · ${s ? bi(lang, s) : t ? bi(lang, t) : ''}`; };
  const exportCsv = () => {
    const rows = [['direction', 'taxType', 'subType', 'base', 'tax'], ...report.out.rows.map((r) => ['output', r.taxType, r.subType, r.base.toFixed(2), r.tax.toFixed(2)]), ...report.inp.rows.map((r) => ['input', r.taxType, r.subType, r.base.toFixed(2), r.tax.toFixed(2)])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `fatura-vat-${month}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="animate-in">
      <PageHeader title={L('Tax reports', 'التقارير الضريبية')} description={L('Monthly VAT position from Valid documents only — the same population ETA uses to pre-fill your VAT return.', 'موقف ضريبة القيمة المضافة الشهري من المستندات الصالحة فقط.')}
        actions={<>
          <Select value={month} onChange={(e) => setMonth(e.target.value)} className="w-auto" aria-label={L('Period', 'الفترة')}>{months.map((m) => <option key={m} value={m}>{fmtMonth(m)}</option>)}</Select>
          <Button icon={<Download className="size-4" />} onClick={exportCsv}>CSV</Button>
          <Button icon={<FileArchive className="size-4" />} onClick={() => toast({ tone: 'info', text: L('Document package requested from ETA — we will notify you when it is ready.', 'تم طلب حزمة المستندات من المصلحة — سنخطرك عند الجاهزية.') })}>{L('ETA package', 'حزمة المصلحة')}</Button>
        </>} />

      <div className="grid gap-3 sm:grid-cols-3 mb-5">
        <div className="card p-5"><div className="text-[12.5px] text-ink-muted">{L('Output VAT (sales)', 'ضريبة المخرجات')}</div><Money value={report.outVat} className="block text-[26px] font-semibold mt-1" /></div>
        <div className="card p-5"><div className="text-[12.5px] text-ink-muted">{L('Input VAT (purchases)', 'ضريبة المدخلات')}</div><Money value={report.inVat} className="block text-[26px] font-semibold mt-1" /></div>
        <div className="card p-5 border-accent/40 bg-accent-soft/40"><div className="text-[12.5px] text-accent font-medium">{report.outVat - report.inVat >= 0 ? L('Net VAT payable', 'صافي الضريبة المستحقة') : L('Net VAT credit', 'رصيد ضريبي دائن')}</div><Money value={Math.abs(report.outVat - report.inVat)} className="block text-[26px] font-semibold mt-1" /></div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {([['out', L('Sales — output taxes', 'المبيعات — ضرائب المخرجات')], ['inp', L('Purchases — input taxes', 'المشتريات — ضرائب المدخلات')]] as const).map(([k, title]) => (
          <Card key={k} title={title} subtitle={L(`Net ${''}`, 'الصافي ') + (k === 'out' ? report.out.net : report.inp.net).toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' EGP'} pad={false}>
            <Table>
              <thead><tr><Th>{L('Tax', 'الضريبة')}</Th><Th align="end">{L('Taxable base', 'الوعاء')}</Th><Th align="end">{L('Tax', 'الضريبة')}</Th></tr></thead>
              <tbody>
                {report[k].rows.length === 0 && <tr><Td className="text-ink-muted">{L('No valid documents in this period.', 'لا توجد مستندات صالحة في هذه الفترة.')}</Td><Td /><Td /></tr>}
                {report[k].rows.map((r) => <tr key={r.taxType + r.subType}><Td className="text-[13px]">{label(r.taxType, r.subType)}</Td><Td align="end"><Money value={r.base} muted /></Td><Td align="end"><Money value={r.tax} className="font-medium" /></Td></tr>)}
              </tbody>
            </Table>
          </Card>
        ))}
      </div>
      {report.wht > 0 && <div className="mt-5"><Callout tone="info" title={L(`Withholding tax deducted by customers: ${report.wht.toFixed(2)} EGP`, `الخصم تحت حساب الضريبة من العملاء: ${report.wht.toFixed(2)} جنيه`)}>{L('Reconcile with the WHT certificates (Form 41) your customers file — this amount is credited against your income tax.', 'طابقه مع نماذج ٤١ التي يقدمها عملاؤك — يُخصم من ضريبة الدخل.')}</Callout></div>}
    </div>
  );
}
