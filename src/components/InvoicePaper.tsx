import { publicDocumentUrl } from '@/eta/client';
import { taxType } from '@/eta/codes';
import { bi, useI18n } from '@/i18n';
import { computeDoc, type Company, type Doc } from '@/store/model';
import { useLabels } from '@/pages/app/shared';
import { QR } from './QR';
import { Logo } from './brand';

/** The customer-facing printout. Always light, A4 proportions, bilingual headings like Egyptian tax invoices. */
export function InvoicePaper({ doc, company, env }: { doc: Doc; company: Company; env: 'preprod' | 'production' }) {
  const { L, lang, money, date } = useI18n();
  const lb = useLabels();
  const { lines, totals } = computeDoc(doc);
  const branch = company.branches.find((b) => b.id === doc.branchId) ?? company.branches[0];
  const sent = doc.direction === 'sent';
  const issuer = sent ? { name: bi(lang, { en: company.name, ar: company.nameAr }), id: company.rin, addr: branch.address } : { name: doc.counterparty.name ?? '', id: doc.counterparty.id ?? '', addr: doc.counterparty.address };
  const receiver = sent ? { name: doc.counterparty.name ?? L('Walk-in customer', 'عميل نقدي'), id: doc.counterparty.id, addr: doc.counterparty.address } : { name: company.name, id: company.rin, addr: branch.address };
  const fmtAddr = (a?: typeof branch.address) => a ? [a.buildingNumber, a.street, a.regionCity, a.governate, a.country].filter(Boolean).join(', ') : '—';
  const url = doc.uuid && doc.longId ? publicDocumentUrl(doc.uuid, doc.longId, env) : '';
  const valid = doc.status === 'Valid';

  return (
    <article className="print-area paper-light relative bg-white text-[#1b1f1e] rounded-lg border border-line shadow-card p-5 sm:p-8 text-[12.5px] leading-relaxed overflow-hidden" style={{ colorScheme: 'light' }}>
      {!valid && (
        <div className="absolute top-6 end-[-44px] rotate-45 rtl:-rotate-45 bg-[#b42828] text-white text-[11px] font-semibold tracking-[.12em] uppercase px-14 py-1">
          {doc.status === 'Draft' ? L('Draft — not issued', 'مسودة') : doc.status}
        </div>
      )}
      <header className="flex flex-wrap items-start justify-between gap-6 pb-6 border-b border-[#e3ded3]">
        <div>
          {sent ? <Logo /> : <div className="text-[16px] font-semibold">{issuer.name}</div>}
          <div className="mt-3 font-semibold text-[14px]">{issuer.name}</div>
          <div className="text-[#5a605e]">{fmtAddr(issuer.addr)}</div>
          <div className="text-[#5a605e]" dir="ltr">{L('Tax reg. no.', 'رقم التسجيل الضريبي')} {issuer.id}</div>
        </div>
        <div className="text-end">
          <div className="text-[22px] font-semibold tracking-[-0.01em]">{lb.docType(doc.documentType)}</div>
          <div className="text-[13px] text-[#5a605e]">{lang === 'en' ? { I: 'فاتورة ضريبية', C: 'إشعار دائن', D: 'إشعار مدين', EI: 'فاتورة تصدير', EC: 'إشعار دائن تصدير', ED: 'إشعار مدين تصدير' }[doc.documentType] : { I: 'Tax invoice', C: 'Credit note', D: 'Debit note', EI: 'Export invoice', EC: 'Export credit note', ED: 'Export debit note' }[doc.documentType]}</div>
          <dl className="mt-3 grid grid-cols-[auto_auto] gap-x-4 gap-y-0.5 justify-end text-[12px]">
            <dt className="text-[#7c827f]">{L('Number', 'الرقم')}</dt><dd className="font-medium">{doc.internalID}</dd>
            <dt className="text-[#7c827f]">{L('Issued', 'التاريخ')}</dt><dd>{date(doc.issuedAt, 'datetime')}</dd>
            {doc.poRef && <><dt className="text-[#7c827f]">{L('PO ref.', 'أمر الشراء')}</dt><dd>{doc.poRef}</dd></>}
          </dl>
        </div>
      </header>

      <section className="grid sm:grid-cols-2 gap-6 py-6">
        <div>
          <div className="text-[11px] uppercase tracking-[.08em] text-[#7c827f] mb-1">{L('Bill to', 'العميل')}</div>
          <div className="font-semibold text-[14px]">{receiver.name}</div>
          <div className="text-[#5a605e]">{fmtAddr(receiver.addr)}</div>
          {receiver.id && <div className="text-[#5a605e]" dir="ltr">{lb.partyId(doc.counterparty.type)}: {receiver.id}</div>}
        </div>
        {doc.references?.length ? (
          <div>
            <div className="text-[11px] uppercase tracking-[.08em] text-[#7c827f] mb-1">{L('Adjusts invoice', 'تعديل للفاتورة')}</div>
            <div className="font-mono text-[11.5px] break-all" dir="ltr">{doc.references.join(', ')}</div>
          </div>
        ) : null}
      </section>

      <div className="overflow-x-auto -mx-1 px-1">
      <table className="w-full border-collapse min-w-[480px]">
        <thead>
          <tr className="text-[11px] uppercase tracking-[.06em] text-[#7c827f] border-y border-[#e3ded3]">
            <th className="text-start py-2 pe-2 font-medium">{L('Description', 'الوصف')}</th>
            <th className="text-end py-2 px-2 font-medium">{L('Qty', 'الكمية')}</th>
            <th className="text-end py-2 px-2 font-medium">{L('Unit price', 'السعر')}</th>
            <th className="text-end py-2 px-2 font-medium">{L('Taxes', 'الضرائب')}</th>
            <th className="text-end py-2 ps-2 font-medium">{L('Amount', 'المبلغ')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} className="border-b border-[#efebe3] align-top">
              <td className="py-2.5 pe-2">
                <div className="font-medium">{l.description}</div>
                <div className="text-[11px] text-[#7c827f] font-mono" dir="ltr">{l.itemType} {l.itemCode}</div>
              </td>
              <td className="py-2.5 px-2 text-end tabular whitespace-nowrap">{l.quantity} {l.unitType}</td>
              <td className="py-2.5 px-2 text-end tabular whitespace-nowrap">{money(doc.lines[i].unitPrice, doc.lines[i].currency)}</td>
              <td className="py-2.5 px-2 text-end tabular text-[11.5px] text-[#5a605e] whitespace-nowrap">{l.taxableItems.map((t) => `${t.taxType} ${t.rate || !t.amount ? `${t.rate}%` : money(t.amount)}`).join(' · ')}</td>
              <td className="py-2.5 ps-2 text-end tabular whitespace-nowrap font-medium">{money(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <section className="flex flex-col-reverse sm:flex-row justify-between gap-6 mt-6">
        <div className="flex gap-4 items-start">
          {url && valid ? (
            <>
              <QR value={url} size={104} />
              <div className="max-w-[220px]">
                <div className="font-semibold">{L('Verified by the Egyptian Tax Authority', 'معتمدة من مصلحة الضرائب المصرية')}</div>
                <div className="text-[#5a605e] mt-0.5">{L('Scan to verify this document on the ETA portal.', 'امسح للتحقق من المستند على بوابة المصلحة.')}</div>
                <div className="mt-1.5 font-mono text-[10.5px] text-[#7c827f] break-all" dir="ltr">UUID {doc.uuid}</div>
              </div>
            </>
          ) : sent ? (
            <div className="text-[#5a605e] max-w-[260px]">
              <div className="font-semibold text-[#1b1f1e]">{L('Payment details', 'بيانات الدفع')}</div>
              {company.bankName}<br /><span className="font-mono text-[11px]" dir="ltr">{company.iban}</span>
            </div>
          ) : null}
        </div>
        <dl className="min-w-[260px] space-y-1 tabular">
          <div className="flex justify-between gap-6"><dt className="text-[#5a605e]">{L('Net amount', 'صافي المبلغ')}</dt><dd>{money(totals.netAmount)}</dd></div>
          {totals.taxTotals.map((t) => (
            <div key={t.taxType} className="flex justify-between gap-6"><dt className="text-[#5a605e]">{bi(lang, taxType(t.taxType) ?? { en: t.taxType, ar: t.taxType })}</dt><dd>{t.taxType === 'T4' ? '−' : ''}{money(t.amount)}</dd></div>
          ))}
          {totals.extraDiscountAmount > 0 && <div className="flex justify-between gap-6"><dt className="text-[#5a605e]">{L('Extra discount', 'خصم إضافي')}</dt><dd>−{money(totals.extraDiscountAmount)}</dd></div>}
          <div className="flex justify-between gap-6 pt-2 mt-2 border-t border-[#1b1f1e] text-[15px] font-semibold"><dt>{L('Total', 'الإجمالي')}</dt><dd>{money(totals.totalAmount)}</dd></div>
        </dl>
      </section>
      {valid && url && sent && (
        <p className="mt-6 pt-4 border-t border-[#efebe3] text-[11.5px] text-[#7c827f]">{L('Pay to', 'الدفع إلى')} {company.bankName} · <span dir="ltr" className="font-mono">{company.iban}</span>{doc.notes ? ` · ${doc.notes}` : ''}</p>
      )}
    </article>
  );
}
