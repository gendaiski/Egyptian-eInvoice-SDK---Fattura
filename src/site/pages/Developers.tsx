import { Code2, FileSpreadsheet, Usb, Webhook } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ENDPOINTS } from '@/eta/client';
import { serializeForSigning } from '@/eta/serialize';
import { useI18n } from '@/i18n';
import { toEtaDocument } from '@/store/model';
import { useStore } from '@/store/store';
import { Badge, CopyButton, LinkButton, Mono, Segmented } from '@/components/ui';
import { CtaBand, PageHero, Section, SectionHead } from '../kit';

export function Developers() {
  const { db } = useStore();
  const { L } = useI18n();
  const doc = db.docs.find((d) => d.direction === 'sent' && d.status === 'Valid' && d.documentType === 'I')!;
  const eta = useMemo(() => toEtaDocument(doc, db.company), [doc, db.company]);
  const [tab, setTab] = useState<'create' | 'payload' | 'canonical' | 'webhook'>('create');
  const samples: Record<typeof tab, string> = {
    create: `curl -X POST https://api.fatura.eg/v1/documents \\
  -H "Authorization: Bearer $FATURA_API_KEY" \\
  -H "Content-Type: application/json; charset=utf-8" \\
  -d '{
    "type": "I",
    "customer": "${doc.customerId}",
    "lines": [{ "item": "IMPL01", "quantity": 5 }],
    "payment_plan": { "kind": "installments", "count": 4, "down_payment_pct": 25 },
    "submit": true
  }'`,
    payload: JSON.stringify(eta, null, 2),
    canonical: serializeForSigning(eta),
    webhook: JSON.stringify({ event: 'document.validated', created_at: new Date().toISOString(), data: { id: doc.id, internal_id: doc.internalID, eta_uuid: doc.uuid, status: 'Valid', total: eta.totalAmount } }, null, 2),
  };
  return (
    <>
      <PageHero kicker={L('Developers', 'المطورون')} title={L('Connect any ERP without touching the ETA SDK.', 'اربط أي نظام ERP دون التعامل مع حزمة المصلحة.')}
        lead={L('Send Fatura a simple document; we compute taxes, sign through your signer, submit, poll and call you back. Or import CSV from any system.', 'أرسل لفاتورة مستنداً بسيطاً؛ نحسب الضرائب ونوقّع ونرسل ونتابع ونبلغك.')}
        actions={<><LinkButton to="/contact?topic=partnership" variant="primary" size="lg">{L('Request API access', 'اطلب الوصول للواجهة')}</LinkButton><LinkButton to="/eta-guide" size="lg">{L('ETA guide', 'دليل المصلحة')}</LinkButton></>} />
      <Section>
        <div className="grid gap-4 md:grid-cols-4">
          {[[<Code2 key="a" />, L('REST API', 'واجهة REST'), L('Create, submit, cancel and search documents. Idempotent by internal number.', 'إنشاء وإرسال وإلغاء وبحث، مع منع التكرار بالرقم الداخلي.')],
            [<Webhook key="b" />, L('Webhooks', 'Webhooks'), L('document.validated, document.invalid, received.cancellation_requested and more.', 'أحداث الاعتماد والرفض وطلبات الإلغاء.')],
            [<FileSpreadsheet key="c" />, L('CSV & Excel import', 'استيراد CSV وإكسل'), L('One row per line; rows sharing an internal number become one document.', 'صف لكل بند؛ الصفوف بنفس الرقم مستند واحد.')],
            [<Usb key="d" />, L('Fatura Signer', 'برنامج التوقيع'), L('A small agent for Windows and macOS that signs with your USB token via PKCS#11.', 'برنامج صغير يوقّع بالتوكن عبر PKCS#11.')]].map(([icon, t, d], i) => (
            <div key={i} className="card p-5"><span className="text-accent [&>svg]:size-6">{icon}</span><h3 className="mt-4 font-semibold">{t}</h3><p className="mt-1.5 text-[13.5px] text-ink-muted">{d}</p></div>
          ))}
        </div>
      </Section>
      <Section tone="surface">
        <SectionHead title={L('From your system to a Valid document', 'من نظامك إلى مستند صالح')} lead={L('The payload and canonical string below are generated live from a demo invoice by the same code the product runs.', 'الحمولة والصيغة الموقعة أدناه مولدة مباشرة من فاتورة عرض بنفس كود المنتج.')} />
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-b border-line">
            <Segmented size="sm" value={tab} onChange={setTab} options={[{ value: 'create', label: L('Create (Fatura API)', 'إنشاء (واجهة فاتورة)') }, { value: 'payload', label: L('ETA v1.0 JSON', 'JSON المصلحة') }, { value: 'canonical', label: L('Signed string', 'الصيغة الموقعة') }, { value: 'webhook', label: 'Webhook' }]} />
            <CopyButton value={samples[tab]} label={L('Copy', 'نسخ')} />
          </div>
          <pre dir="ltr" className="font-mono text-[12.5px] leading-relaxed p-5 max-h-[460px] overflow-auto whitespace-pre-wrap break-all bg-sunken/40">{samples[tab]}</pre>
        </div>
        <p className="mt-3 text-[12.5px] text-ink-subtle">{L('The Fatura API shown is in preview. Send bodies as UTF-8 without escaping Arabic — ETA hashes the exact bytes it receives.', 'واجهة فاتورة في مرحلة المعاينة. أرسل النص بترميز UTF-8 دون ترميز العربية.')}</p>
      </Section>
      <Section>
        <SectionHead title={L('ETA operations Fatura handles for you', 'عمليات المصلحة التي تتولاها فاتورة')} />
        <div className="overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full text-[14px] min-w-[600px]">
            <tbody className="divide-y divide-line">{ENDPOINTS.map((e) => <tr key={e.op}><td className="p-4">{e.op}</td><td className="p-4"><Badge tone={e.method === 'GET' ? 'info' : e.method === 'POST' ? 'accent' : 'warn'}>{e.method}</Badge></td><td className="p-4"><Mono className="text-ink-muted">{e.path}</Mono></td></tr>)}</tbody>
          </table>
        </div>
      </Section>
      <CtaBand title={L('Building an integration for clients?', 'تبني تكاملاً لعملائك؟')} lead={L('Partners get sandbox tenants and a direct line to our engineers.', 'الشركاء يحصلون على بيئات اختبار وتواصل مباشر مع مهندسينا.')} primary={{ to: '/contact?topic=partnership', label: L('Become a partner', 'كن شريكاً') }} />
    </>
  );
}
