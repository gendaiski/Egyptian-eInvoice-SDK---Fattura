import { MonitorSmartphone, ReceiptText, Wifi, Link2 } from 'lucide-react';
import { useI18n } from '@/i18n';
import { LinkButton } from '@/components/ui';
import { Checks, CtaBand, PageHero, Section, SectionHead } from '../kit';

export function ReceiptsPage() {
  const { L, money } = useI18n();
  return (
    <>
      <PageHero kicker={L('E-receipts', 'الإيصالات الإلكترونية')} title={L('Every till receipt, registered as it prints.', 'كل إيصال بيع يُسجَّل لحظة طباعته.')}
        lead={L('B2C receipts from your registered POS devices go to ETA in real time with the e-receipt API. Sales, returns and VAT roll up per branch.', 'إيصالات البيع للمستهلك تصل للمصلحة لحظياً من أجهزة نقاط البيع المسجلة.')}
        actions={<><LinkButton to="/contact?topic=sales" variant="primary" size="lg">{L('Talk to sales', 'تحدث للمبيعات')}</LinkButton><LinkButton to="/app/receipts" size="lg">{L('See demo receipts', 'اعرض إيصالات العرض')}</LinkButton></>}
        aside={
          <div className="card p-6 max-w-[360px] mx-auto font-mono text-[12.5px] leading-relaxed" dir="ltr">
            <div className="text-center font-display text-[15px] font-semibold">Delta Café · Zamalek</div>
            <div className="text-center text-ink-subtle">POS-SN-77812 · Branch 1</div>
            <div className="my-3 border-t border-dashed border-line-strong" />
            {[['Flat white × 2', 140], ['Croissant × 1', 85], ['Water 600ml × 1', 20]].map(([k, v]) => <div key={k as string} className="flex justify-between"><span>{k}</span><span>{(v as number).toFixed(2)}</span></div>)}
            <div className="my-3 border-t border-dashed border-line-strong" />
            <div className="flex justify-between"><span>VAT 14% incl.</span><span>30.09</span></div>
            <div className="flex justify-between font-semibold text-[14px]"><span>Total</span><span>{money(245)}</span></div>
            <div className="mt-3 text-[11px] text-ink-subtle break-all">UUID 9f2c…a71e · prev 4b10…c2d9</div>
          </div>
        } />
      <Section>
        <SectionHead title={L('How e-receipts work', 'كيف تعمل الإيصالات الإلكترونية')} />
        <div className="grid gap-4 md:grid-cols-3">
          {[
            [<MonitorSmartphone key="a" />, L('Register each device', 'سجّل كل جهاز'), L('Each POS is registered with its serial number. Fatura stores the per-device credentials and rotates tokens.', 'يُسجّل كل جهاز برقمه التسلسلي وتدير فاتورة بياناته.')],
            [<Link2 key="b" />, L('A chained receipt UUID', 'معرّف إيصال متسلسل'), L('Each receipt’s UUID is a SHA-256 of its content and references the previous one, so gaps are visible.', 'معرّف كل إيصال بصمة SHA-256 مرتبطة بالسابق فتظهر الفجوات.')],
            [<Wifi key="c" />, L('Offline, then catch up', 'دون اتصال ثم المزامنة'), L('If the connection drops, receipts queue on the device and submit in order when it returns.', 'عند انقطاع الاتصال تُخزن الإيصالات وتُرسل بالترتيب عند عودته.')],
          ].map(([icon, t, d], i) => (
            <div key={i} className="card p-6">
              <span className="size-10 rounded-control bg-accent-soft text-accent grid place-items-center [&>svg]:size-5">{icon}</span>
              <h3 className="mt-5 font-semibold text-[17px]">{t}</h3>
              <p className="mt-2 text-ink-muted text-[14px]">{d}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section tone="surface">
        <div className="grid gap-10 md:grid-cols-2 items-start">
          <SectionHead className="mb-0" title={L('Made for counters, not accountants', 'مصممة للكاشير لا للمحاسب')} lead={L('Cashiers never see tax fields. Finance gets the daily totals, returns and device health in one place.', 'الكاشير لا يرى حقول الضريبة، والمالية ترى الإجماليات والمرتجعات وحالة الأجهزة.')} />
          <Checks className="text-[15px]" items={[L('Sales (s) and return (r) receipts', 'إيصالات بيع ومرتجع'), L('Cash, card and wallet payment methods', 'نقدي وبطاقة ومحفظة'), L('Buyer ID captured above the ETA threshold', 'تسجيل هوية المشتري فوق حد المصلحة'), L('Device status and last receipt per till', 'حالة الجهاز وآخر إيصال لكل نقطة'), L('Available on the Scale plan, up to 20 devices', 'متاحة في باقة التوسع حتى ٢٠ جهازاً')]} />
        </div>
      </Section>
      <CtaBand title={L('Bring your tills online with ETA.', 'اربط نقاط بيعك بالمصلحة.')} primary={{ to: '/contact?topic=sales', label: L('Talk to sales', 'تحدث للمبيعات') }} secondary={{ to: '/pricing', label: L('See pricing', 'الأسعار') }} />
      <span className="sr-only"><ReceiptText /></span>
    </>
  );
}
