import { Plus, Star } from 'lucide-react';
import { useState } from 'react';
import { bi, useI18n } from '@/i18n';
import type { Plan } from '@/store/model';
import { useStore } from '@/store/store';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Switch, useToast } from '@/components/ui';

export function Plans() {
  const { db, set } = useStore();
  const { L, lang, money, num } = useI18n();
  const toast = useToast();
  const [edit, setEdit] = useState<Plan | null>(null);
  return (
    <div className="animate-in">
      <PageHeader title={L('Plans & pricing', 'الباقات والأسعار')} description={L('Each plan is sold four ways: monthly, yearly, a yearly licence in installments, or a one-time licence. Prices exclude 14% VAT.', 'كل باقة تُباع بأربع طرق: شهري وسنوي وتقسيط وترخيص دائم. الأسعار لا تشمل الضريبة.')}
        actions={<Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setEdit({ id: `plan${db.admin.plans.length + 1}`, name: '', nameAr: '', blurb: { en: '', ar: '' }, docsPerMonth: 500, users: 5, branches: 2, features: [], monthly: 0, yearly: 0, oneTime: 0, installments: { count: 6, amount: 0 }, active: false })}>{L('New plan', 'باقة جديدة')}</Button>} />
      <div className="grid gap-4 lg:grid-cols-3">
        {db.admin.plans.map((p) => {
          const subs = db.admin.tenants.filter((t) => t.planId === p.id).length;
          return (
            <Card key={p.id} className={p.featured ? 'ring-1 ring-accent border-accent' : ''}>
              <div className="flex items-start justify-between gap-3">
                <div><div className="flex items-center gap-2"><h2 className="text-[18px] font-semibold">{bi(lang, { en: p.name, ar: p.nameAr })}</h2>{p.featured && <Star className="size-4 text-accent fill-accent" />}</div><p className="text-[13px] text-ink-muted mt-0.5">{bi(lang, p.blurb)}</p></div>
                <Badge tone={p.active ? 'ok' : 'neutral'}>{p.active ? L('On sale', 'متاحة') : L('Hidden', 'مخفية')}</Badge>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-[13px]">
                {[[L('Monthly', 'شهري'), money(p.monthly)], [L('Yearly', 'سنوي'), money(p.yearly)], [L('Installments', 'تقسيط'), `${p.installments.count} × ${money(p.installments.amount)}`], [L('One-time', 'مرة واحدة'), money(p.oneTime)]].map(([k, v]) => (
                  <div key={k} className="rounded-md bg-sunken/60 p-2.5"><dt className="text-ink-subtle text-[12px]">{k}</dt><dd className="font-medium tabular mt-0.5">{v}</dd></div>
                ))}
              </dl>
              <div className="mt-4 text-[13px] text-ink-muted">{num(p.docsPerMonth)} {L('docs/mo', 'مستند/شهر')} · {p.users} {L('users', 'مستخدم')} · {p.branches} {L('branches', 'فرع')}</div>
              <div className="mt-4 pt-4 border-t border-line flex items-center justify-between"><span className="text-[13px] text-ink-muted">{L(`${subs} tenants`, `${subs} شركة`)}</span><Button size="sm" onClick={() => setEdit(structuredClone(p))}>{L('Edit', 'تعديل')}</Button></div>
            </Card>
          );
        })}
      </div>
      {edit && (
        <Modal open onClose={() => setEdit(null)} size="lg" title={edit.name ? L(`Edit ${edit.name}`, `تعديل ${edit.nameAr}`) : L('New plan', 'باقة جديدة')}
          footer={<><Button onClick={() => setEdit(null)}>{L('Cancel', 'إلغاء')}</Button><Button variant="primary" disabled={!edit.name} onClick={() => { set((x) => { const i = x.admin.plans.findIndex((y) => y.id === edit.id); if (i >= 0) x.admin.plans[i] = edit; else x.admin.plans.push(edit); }); setEdit(null); toast({ tone: 'ok', text: L('Plan saved. Existing subscribers keep their price until renewal.', 'تم الحفظ. يحتفظ المشتركون بأسعارهم حتى التجديد.') }); }}>{L('Save plan', 'حفظ')}</Button></>}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={L('Name', 'الاسم')}>{(id) => <Input id={id} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />}</Field>
            <Field label={L('Name (Arabic)', 'الاسم بالعربية')}>{(id) => <Input id={id} dir="rtl" value={edit.nameAr} onChange={(e) => setEdit({ ...edit, nameAr: e.target.value })} />}</Field>
            <Field label={L('Tagline', 'الوصف')} className="sm:col-span-2">{(id) => <Input id={id} value={edit.blurb.en} onChange={(e) => setEdit({ ...edit, blurb: { ...edit.blurb, en: e.target.value } })} />}</Field>
            {([['monthly', L('Monthly price', 'السعر الشهري')], ['yearly', L('Yearly price', 'السعر السنوي')], ['oneTime', L('One-time licence', 'الترخيص الدائم')]] as const).map(([k, label]) => (
              <Field key={k} label={`${label} (EGP)`}>{(id) => <Input id={id} type="number" min={0} value={edit[k]} onChange={(e) => setEdit({ ...edit, [k]: Number(e.target.value) })} />}</Field>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <Field label={L('Installments', 'الأقساط')}>{(id) => <Input id={id} type="number" min={2} max={12} value={edit.installments.count} onChange={(e) => setEdit({ ...edit, installments: { ...edit.installments, count: Number(e.target.value) } })} />}</Field>
              <Field label={L('Each (EGP)', 'القسط')}>{(id) => <Input id={id} type="number" min={0} value={edit.installments.amount} onChange={(e) => setEdit({ ...edit, installments: { ...edit.installments, amount: Number(e.target.value) } })} />}</Field>
            </div>
            <Field label={L('Documents / month', 'مستند / شهر')}>{(id) => <Input id={id} type="number" value={edit.docsPerMonth} onChange={(e) => setEdit({ ...edit, docsPerMonth: Number(e.target.value) })} />}</Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={L('Users', 'المستخدمون')}>{(id) => <Input id={id} type="number" value={edit.users} onChange={(e) => setEdit({ ...edit, users: Number(e.target.value) })} />}</Field>
              <Field label={L('Branches', 'الفروع')}>{(id) => <Input id={id} type="number" value={edit.branches} onChange={(e) => setEdit({ ...edit, branches: Number(e.target.value) })} />}</Field>
            </div>
            <div className="sm:col-span-2 space-y-3 pt-2">
              <Switch checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} label={L('On sale', 'متاحة للبيع')} description={L('Shown on the pricing page and in-app upgrades.', 'تظهر في صفحة الأسعار والترقية.')} />
              <Switch checked={!!edit.featured} onChange={(v) => setEdit({ ...edit, featured: v })} label={L('Highlight as recommended', 'إبراز كموصى بها')} />
            </div>
            {edit.yearly > 0 && edit.installments.amount > 0 && <p className="sm:col-span-2 text-[12.5px] text-ink-muted">{L(`Installment total ${money(edit.installments.amount * edit.installments.count)} vs yearly ${money(edit.yearly)} — a ${(((edit.installments.amount * edit.installments.count) / edit.yearly - 1) * 100).toFixed(1)}% premium.`, `إجمالي التقسيط ${money(edit.installments.amount * edit.installments.count)} مقابل السنوي ${money(edit.yearly)}.`)}</p>}
          </div>
        </Modal>
      )}
    </div>
  );
}
