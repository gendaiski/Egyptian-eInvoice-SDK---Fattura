import { Briefcase, Building2, Globe2, Store } from 'lucide-react';
import { type ReactNode } from 'react';
import { useI18n } from '@/i18n';
import { Badge, LinkButton } from '@/components/ui';
import { Checks, CtaBand, PageHero, Wrap } from '../kit';

function Audience({ id, icon, title, lead, points, plan, cta }: { id: string; icon: ReactNode; title: string; lead: string; points: string[]; plan: string; cta: { to: string; label: string } }) {
  const { L } = useI18n();
  return (
    <section id={id} className="scroll-mt-24 py-12 border-b border-line last:border-0 grid gap-8 md:grid-cols-[64px_minmax(0,1fr)_minmax(0,0.9fr)]">
      <span className="size-12 rounded-card bg-accent text-accent-on grid place-items-center [&>svg]:size-6">{icon}</span>
      <div>
        <h2 className="font-display text-title">{title}</h2>
        <p className="mt-3 text-lead text-ink-muted max-w-[52ch]">{lead}</p>
        <div className="mt-5 flex items-center gap-3"><span className="text-[13px] text-ink-subtle">{L('Usually starts on', 'تبدأ عادة بباقة')}</span><Badge tone="accent">{plan}</Badge></div>
        <LinkButton to={cta.to} className="mt-6">{cta.label}</LinkButton>
      </div>
      <Checks className="text-[15px] md:pt-2" items={points} />
    </section>
  );
}

export function Solutions() {
  const { L } = useI18n();
  return (
    <>
      <PageHero title={L('Built for the way Egyptian businesses invoice.', 'مصممة لطريقة فوترة الشركات المصرية.')} lead={L('Whether you send twenty invoices a month or twenty thousand, the compliance work is the same. The setup isn’t.', 'سواء أرسلت عشرين فاتورة أو عشرين ألفاً، الامتثال واحد والإعداد يختلف.')} />
      <Wrap>
        <Audience id="smes" icon={<Building2 />} title={L('Small and mid-sized companies', 'الشركات الصغيرة والمتوسطة')} plan="Growth"
          lead={L('Replace manual portal entry with a composer that gets totals right and tells you why something would fail.', 'استبدل الإدخال اليدوي على البوابة بمحرر دقيق يخبرك بسبب أي رفض.')}
          points={[L('Recurring invoices for retainers and rent', 'فواتير متكررة للعقود والإيجارات'), L('Installment plans with reminders', 'خطط تقسيط مع تذكيرات'), L('CSV import from Excel or your ERP', 'استيراد CSV من إكسل أو ERP'), L('Monthly VAT summary for your accountant', 'ملخص ضريبي شهري لمحاسبك')]}
          cta={{ to: '/signup?plan=growth&billing=monthly', label: L('Start on Growth', 'ابدأ بباقة النمو') }} />
        <Audience id="accountants" icon={<Briefcase />} title={L('Accounting and tax firms', 'مكاتب المحاسبة والضرائب')} plan="Scale"
          lead={L('Run e-invoicing for many clients from one login, each with its own ETA credentials, signer and team.', 'أدِر الفوترة لعملاء متعددين من دخول واحد، لكل منهم بياناته وتوقيعه.')}
          points={[L('Separate workspaces per client RIN', 'مساحة منفصلة لكل رقم ضريبي'), L('Read-only access for client staff', 'وصول للقراءة فقط لموظفي العميل'), L('Cross-client invalid-document queue', 'قائمة موحدة للمستندات غير الصالحة'), L('Partner pricing for firms', 'أسعار شراكة للمكاتب')]}
          cta={{ to: '/contact?topic=partnership', label: L('Talk about a partnership', 'تحدث عن شراكة') }} />
        <Audience id="retail" icon={<Store />} title={L('Retail and restaurants', 'التجزئة والمطاعم')} plan="Scale"
          lead={L('E-receipts from every till plus B2B invoices for corporate customers, in one place.', 'إيصالات من كل نقطة بيع وفواتير للعملاء من الشركات في مكان واحد.')}
          points={[L('POS e-receipts up to 20 devices', 'إيصالات حتى ٢٠ جهازاً'), L('Branch-level codes and totals', 'أكواد وإجماليات لكل فرع'), L('Returns handled as return receipts', 'المرتجعات كإيصالات مرتجع')]}
          cta={{ to: '/e-receipts', label: L('See e-receipts', 'الإيصالات الإلكترونية') }} />
        <Audience id="exporters" icon={<Globe2 />} title={L('Exporters', 'المصدّرون')} plan="Growth"
          lead={L('Export invoices to foreign buyers with the right VAT subtype and per-line exchange rates.', 'فواتير تصدير للمشترين الأجانب بالنوع الفرعي الصحيح وأسعار صرف لكل بند.')}
          points={[L('V001 / V002 export subtypes preset', 'أنواع التصدير مضبوطة مسبقاً'), L('USD, EUR and 170+ other currencies', 'الدولار واليورو وأكثر من ١٧٠ عملة'), L('Foreign receivers with passport or foreign ID', 'مستلمون أجانب برقم هوية أجنبية'), L('Bilingual PDF for your buyer', 'PDF ثنائي اللغة للمشتري')]}
          cta={{ to: '/app/documents/new?type=EI', label: L('Try an export invoice', 'جرّب فاتورة تصدير') }} />
      </Wrap>
      <CtaBand title={L('Not sure which setup fits?', 'لست متأكداً أي إعداد يناسبك؟')} lead={L('Tell us your volume and systems; we’ll recommend a plan.', 'أخبرنا بحجمك وأنظمتك وسنقترح باقة.')} primary={{ to: '/contact?topic=sales', label: L('Ask sales', 'اسأل المبيعات') }} secondary={{ to: '/pricing', label: L('See pricing', 'الأسعار') }} />
    </>
  );
}
