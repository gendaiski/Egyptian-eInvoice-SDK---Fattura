import { Bell, CheckCircle2, FileText, Inbox, Plus, Send, Trash2, Usb, Wallet, XCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/i18n';
import type { DocStatus } from '@/eta/types';
import { BarChart, Sparkline, StackedMeter } from '@/components/charts';
import { Stamp } from '@/components/Stamp';
import {
  Badge, Button, Callout, EmptyState, Field, IconButton, Input, Modal, Progress, Segmented, Select, Skeleton, Stat, StatusBadge, Switch, Table, Tabs, Td, Textarea, Th, cx, useToast,
} from '@/components/ui';
import { Wrap } from '../kit';

/* ---------- colour maths for live contrast ---------- */
const lum = (rgb: number[]) => { const c = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const contrast = (a: number[], b: number[]) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
const hex = (rgb: number[]) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
function readToken(name: string): number[] {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return v.split(/\s+/).map(Number);
}

function useTokens(names: string[]) {
  const { theme } = useI18n();
  const [vals, setVals] = useState<Record<string, number[]>>({});
  useEffect(() => { const t = setTimeout(() => setVals(Object.fromEntries(names.map((n) => [n, readToken(n)]))), 30); return () => clearTimeout(t); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return vals;
}

function Block({ id, title, lead, children }: { id: string; title: string; lead?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 py-12 border-b border-line last:border-0">
      <h2 className="font-display text-[28px] font-semibold">{title}</h2>
      {lead && <p className="mt-2 text-ink-muted max-w-[64ch]">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Spec({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-card border border-line bg-surface overflow-hidden', className)}>
      <div className="px-4 py-2 border-b border-line bg-sunken/50 text-[12px] font-medium text-ink-muted">{label}</div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function DesignSystem() {
  const { L, theme, setTheme, money } = useI18n();
  const toast = useToast();
  const [modal, setModal] = useState(false);
  const [seg, setSeg] = useState<'one' | 'rec' | 'inst'>('rec');
  const [tab, setTab] = useState<'all' | 'valid' | 'invalid'>('all');
  const [sw, setSw] = useState(true);

  const groups: [string, string, string[]][] = [
    [L('Neutrals', 'المحايدة'), L('Stone, biased slightly toward the accent hue so greys never look unconsidered.', 'رمادي حجري مائل قليلاً للون الأساسي.'), ['canvas', 'surface', 'sunken', 'line', 'line-strong', 'ink', 'ink-muted', 'ink-subtle']],
    [L('Brand', 'العلامة'), L('One accent: Nile. Gold appears only in the logo dot and the seal.', 'لون أساسي واحد: النيل. الذهبي في نقطة الشعار والختم فقط.'), ['accent', 'accent-strong', 'accent-soft', 'accent-on', 'gold']],
    [L('Status', 'الحالات'), L('Reserved for state. Always paired with an icon and a word, never colour alone.', 'مخصصة للحالة، ومعها دائماً أيقونة وكلمة.'), ['ok', 'ok-soft', 'warn', 'warn-soft', 'bad', 'bad-soft', 'info', 'info-soft']],
  ];
  const tokens = useTokens([...groups.flatMap((g) => g[2])]);
  const surface = tokens.surface;

  const nav = [
    ['principles', L('Principles', 'المبادئ')], ['colour', L('Colour', 'الألوان')], ['type', L('Typography', 'الخطوط')], ['shape', L('Space & shape', 'المسافات والأشكال')],
    ['motion', L('Motion', 'الحركة')], ['icons', L('Icons', 'الأيقونات')], ['components', L('Components', 'المكونات')], ['patterns', L('Patterns', 'الأنماط')],
    ['voice', L('Voice', 'الأسلوب')], ['a11y', L('Accessibility', 'الإتاحة')],
  ];
  const statuses: DocStatus[] = ['Draft', 'Signing', 'Submitted', 'Valid', 'Invalid', 'Rejected', 'Cancelled'];

  return (
    <>
      <section className="pt-12 sm:pt-16 pb-10 border-b border-line">
        <Wrap className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] items-center">
          <div>
            <div className="text-eyebrow uppercase text-accent mb-3">{L('Design system · v2', 'نظام التصميم · الإصدار ٢')}</div>
            <h1 className="text-display">{L('Nile Ledger', 'دفتر النيل')}</h1>
            <p className="mt-4 text-lead text-ink-muted max-w-[60ch]">{L('The tokens, type, components and rules behind Fatura’s product and website. Everything on this page is the live component, rendered with the current theme and language.', 'الرموز والخطوط والمكونات والقواعد خلف منتج فاتورة وموقعها. كل ما في الصفحة مكون حي بالسمة واللغة الحاليتين.')}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Segmented value={theme} onChange={setTheme} options={[{ value: 'light', label: L('Light', 'فاتح') }, { value: 'dark', label: L('Dark', 'داكن') }]} />
              <span className="text-[13px] text-ink-subtle">{L('Switch the language from the header to see RTL.', 'غيّر اللغة من الأعلى لترى الاتجاه من اليمين.')}</span>
            </div>
          </div>
          <Stamp size={168} />
        </Wrap>
      </section>

      <Wrap className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="hidden lg:block sticky top-24 self-start pt-12" aria-label={L('Sections', 'الأقسام')}>
          <ul className="space-y-0.5 text-[13.5px]">{nav.map(([id, t]) => <li key={id}><button onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })} className="w-full text-start px-2 py-1.5 rounded-control text-ink-muted hover:text-ink hover:bg-sunken">{t}</button></li>)}</ul>
        </nav>
        <div className="min-w-0">
          <Block id="principles" title={L('Principles', 'المبادئ')}>
            <div className="grid gap-6 sm:grid-cols-2">
              {[
                [L('The document is the hero', 'المستند هو البطل'), L('Tax documents are the product. Show the real invoice, its status and its numbers before any decoration.', 'المستند الضريبي هو المنتج. اعرض الفاتورة وحالتها وأرقامها قبل أي زخرفة.')],
                [L('State before style', 'الحالة قبل الشكل'), L('Valid, Invalid, overdue: state is encoded in form (icon, chip, stripe) and words, then colour.', 'الحالة تُعرض بالأيقونة والكلمة ثم اللون.')],
                [L('Two scripts, one system', 'خطان ونظام واحد'), L('Arabic is designed, not mirrored. Logical properties everywhere; IDs, codes and IBANs stay left-to-right.', 'العربية مصممة لا معكوسة. الرموز والأرقام تبقى من اليسار.')],
                [L('Calm by default, loud on purpose', 'هادئ افتراضياً وواضح عند الحاجة'), L('Quiet neutrals and one accent. Emphasis is spent on what needs action.', 'محايدة هادئة ولون واحد، والتأكيد لما يحتاج إجراءً.')],
              ].map(([t, d]) => <div key={t} className="border-s-2 border-accent ps-4"><h3 className="font-semibold text-[16px]">{t}</h3><p className="mt-1 text-ink-muted text-[14px]">{d}</p></div>)}
            </div>
          </Block>

          <Block id="colour" title={L('Colour', 'الألوان')} lead={L('Defined once as tokens with light and dark values; components never use literal colours. Contrast is measured live against the surface token.', 'تُعرّف مرة كرموز بقيم فاتحة وداكنة؛ والتباين يُقاس حياً مقابل السطح.')}>
            <div className="space-y-10">
              {groups.map(([g, d, names]) => (
                <div key={g}>
                  <h3 className="font-semibold">{g}</h3><p className="text-[13.5px] text-ink-muted mt-0.5">{d}</p>
                  <div className="mt-4 grid gap-3 grid-cols-2 sm:grid-cols-4">
                    {names.map((n) => {
                      const v = tokens[n];
                      const c = v && surface ? contrast(v, surface) : 0;
                      return (
                        <div key={n} className="rounded-card border border-line overflow-hidden bg-surface">
                          <div className="h-16 border-b border-line" style={{ background: `rgb(var(--${n}))` }} />
                          <div className="p-3 text-[12.5px]">
                            <div className="font-mono text-ink">--{n}</div>
                            <div className="flex justify-between text-ink-subtle mt-0.5 tabular"><span>{v ? hex(v) : '—'}</span><span className={c >= 4.5 ? 'text-ok' : c >= 3 ? 'text-warn' : ''}>{c ? `${c.toFixed(1)}:1` : ''}</span></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <Callout tone="info" title={L('Rules', 'القواعد')}>{L('Text uses ink tokens (AA ≥ 4.5:1 on surface). Accent is for primary actions, links and selection — one accent per screen. The invoice paper is pinned to light tokens so printouts never change with the theme.', 'النص برموز الحبر بتباين ٤٫٥:١ على الأقل. اللون الأساسي للأزرار والروابط والتحديد. ورقة الفاتورة دائماً فاتحة.')}</Callout>
            </div>
          </Block>

          <Block id="type" title={L('Typography', 'الخطوط')} lead={L('Alexandria — an Egyptian-designed Latin and Arabic family by Mohamed Gaber — carries display text in both scripts. Geist and IBM Plex Sans Arabic set the interface; Geist Mono sets codes, UUIDs and IBANs.', 'ألكسندريا — خط مصري لاتيني وعربي من تصميم محمد جابر — للعناوين بالخطين. Geist وIBM Plex Sans Arabic للواجهة وGeist Mono للأكواد.')}>
            <div className="grid gap-4 md:grid-cols-2">
              <Spec label="Display · Alexandria 600"><div className="font-display text-[44px] leading-[1.05] font-semibold tracking-[-0.03em]">Valid. <span dir="rtl" lang="ar">صالحة.</span></div></Spec>
              <Spec label="Interface · Geist / IBM Plex Sans Arabic"><p className="text-[15px]">Issue ETA-valid invoices and get paid on time.</p><p className="text-[15px] mt-2" dir="rtl" lang="ar" style={{ fontFamily: 'var(--font-body-ar)' }}>أصدر فواتير معتمدة واستلم مستحقاتك في موعدها.</p></Spec>
              <Spec label="Data · Geist Mono" className="md:col-span-2"><div className="font-mono text-[13px] space-y-1" dir="ltr"><div>UUID P39QC3CCRYMBYV9R3Q83GE077V</div><div>EG-100483726-IMPL01 · IBAN EG380019000500000000263180002</div><div className="tabular">EGP 1,234,567.89</div></div></Spec>
            </div>
            <div className="mt-6 rounded-card border border-line bg-surface divide-y divide-line">
              {[
                ['display-xl', 'clamp(40–76px) / 1.02 / −0.035em', 'text-display-xl', L('Hero headline', 'عنوان رئيسي')],
                ['display', 'clamp(32–52px) / 1.06', 'text-display', L('Page title', 'عنوان صفحة')],
                ['title', 'clamp(24–32px) / 1.15', 'text-title font-display', L('Section title', 'عنوان قسم')],
                ['lead', '18px / 1.6', 'text-lead', L('Lead paragraph', 'فقرة تمهيدية')],
                ['body', '14–15px / 1.5', 'text-[14px]', L('Interface text and tables', 'نص الواجهة والجداول')],
                ['caption', '12–12.5px', 'text-[12.5px] text-ink-muted', L('Hints, metadata', 'تلميحات وبيانات')],
                ['eyebrow', '12px / 0.08em / uppercase', 'text-eyebrow uppercase text-accent', L('Rare section label', 'تسمية قسم نادرة')],
              ].map(([n, m, cls, s]) => (
                <div key={n} className="grid gap-2 sm:grid-cols-[140px_minmax(0,1fr)] items-baseline p-4">
                  <div><div className="font-mono text-[12px]">{n}</div><div className="text-[11.5px] text-ink-subtle">{m}</div></div>
                  <div className={cx(cls, 'truncate')}>{s}</div>
                </div>
              ))}
            </div>
          </Block>

          <Block id="shape" title={L('Space & shape', 'المسافات والأشكال')} lead={L('A 4px grid. Radius is assigned by role, not by habit; shadows are reserved for things that float.', 'شبكة ٤ بكسل. الاستدارة حسب الدور، والظلال لما يطفو فقط.')}>
            <div className="grid gap-4 md:grid-cols-3">
              <Spec label={L('Spacing scale', 'سلم المسافات')}><div className="space-y-1.5">{[4, 8, 12, 16, 24, 32, 48, 64, 96].map((s) => <div key={s} className="flex items-center gap-3 text-[12px] tabular"><span className="w-7 text-ink-subtle">{s}</span><span className="h-2.5 rounded-sm bg-accent" style={{ width: s * 1.6 }} /></div>)}</div></Spec>
              <Spec label={L('Radius by role', 'الاستدارة حسب الدور')}><div className="grid grid-cols-2 gap-3 text-[12px]">{[['control · 8', 'rounded-control'], ['card · 14', 'rounded-card'], ['sheet · 20', 'rounded-sheet'], ['pill', 'rounded-full']].map(([l, c]) => <div key={l}><div className={cx('h-14 border-2 border-accent bg-accent-soft', c)} /><div className="mt-1.5 font-mono">{l}</div></div>)}</div></Spec>
              <Spec label={L('Elevation', 'الارتفاع')}><div className="grid gap-4 text-[12px]">{[['0 · flat', 'border border-line'], ['1 · card', 'shadow-card border border-line'], ['2 · popover / modal', 'shadow-pop']].map(([l, c]) => <div key={l} className={cx('h-12 rounded-card bg-surface grid place-items-center font-mono', c)}>{l}</div>)}</div></Spec>
            </div>
          </Block>

          <Block id="motion" title={L('Motion', 'الحركة')} lead={L('Short and functional: state changes, entering panels, progress. Respects reduced-motion everywhere.', 'قصيرة ووظيفية، وتحترم تقليل الحركة.')}>
            <div className="grid gap-4 sm:grid-cols-3">
              {[['--dur-fast', '120ms', L('Hover, press', 'المرور والضغط')], ['--dur-base', '180ms', L('Popovers, toasts', 'القوائم والتنبيهات')], ['--dur-slow', '320ms', L('Progress, charts', 'التقدم والرسوم')]].map(([t, v, d]) => <Spec key={t} label={t}><div className="font-display text-[26px] font-semibold tabular">{v}</div><div className="text-[13px] text-ink-muted">{d} · ease-standard</div></Spec>)}
            </div>
          </Block>

          <Block id="icons" title={L('Icons', 'الأيقونات')} lead={L('Lucide, 2px stroke, 16 / 18 / 20px. Icons label nothing on their own: pair with text or an aria-label.', 'مكتبة Lucide بسمك ٢ بكسل، ودائماً مع نص أو وصف.')}>
            <div className="flex flex-wrap gap-3">{[FileText, Send, Wallet, Inbox, Usb, Bell, CheckCircle2, XCircle, Plus, Trash2].map((I, i) => <span key={i} className="size-12 rounded-card border border-line bg-surface grid place-items-center text-ink"><I className="size-5" /></span>)}</div>
          </Block>

          <Block id="components" title={L('Components', 'المكونات')} lead={L('Every component ships its states: default, hover, focus, active, disabled, loading, empty and error.', 'كل مكون بحالاته: افتراضي وتركيز وتعطيل وتحميل وفراغ وخطأ.')}>
            <div className="grid gap-4 md:grid-cols-2">
              <Spec label={L('Buttons', 'الأزرار')} className="md:col-span-2">
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="primary" icon={<Send className="size-4" />}>{L('Sign & submit', 'توقيع وإرسال')}</Button>
                  <Button>{L('Save draft', 'حفظ مسودة')}</Button>
                  <Button variant="quiet" icon={<Plus className="size-4" />}>{L('Add line', 'إضافة بند')}</Button>
                  <Button variant="ghost">{L('Cancel', 'إلغاء')}</Button>
                  <Button variant="danger" icon={<Trash2 className="size-4" />}>{L('Delete', 'حذف')}</Button>
                  <Button variant="primary" loading>{L('Submitting', 'جارٍ الإرسال')}</Button>
                  <Button disabled>{L('Disabled', 'معطل')}</Button>
                  <IconButton label={L('Notifications', 'الإشعارات')}><Bell className="size-[18px]" /></IconButton>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3"><Button size="sm">Small · 32</Button><Button>Medium · 36</Button><Button size="lg">Large · 44</Button></div>
              </Spec>
              <Spec label={L('Form fields', 'الحقول')}>
                <div className="space-y-4">
                  <Field label={L('Customer tax number', 'الرقم الضريبي للعميل')} hint={L('9 digits.', '٩ أرقام.')}>{(id) => <Input id={id} dir="ltr" defaultValue="204918337" />}</Field>
                  <Field label={L('National ID', 'الرقم القومي')} error={L('National ID must be 14 digits.', 'الرقم القومي ١٤ رقماً.')}>{(id) => <Input id={id} dir="ltr" defaultValue="2900101" aria-invalid />}</Field>
                  <Field label={L('Unit', 'الوحدة')}>{(id) => <Select id={id}><option>EA · Each</option><option>KGM · Kilogram</option></Select>}</Field>
                  <Field label={L('Notes', 'ملاحظات')} optional>{(id) => <Textarea id={id} placeholder={L('Printed on the PDF', 'تُطبع على الفاتورة')} />}</Field>
                </div>
              </Spec>
              <Spec label={L('Selection', 'الاختيار')}>
                <div className="space-y-5">
                  <Segmented value={seg} onChange={setSeg} options={[{ value: 'one', label: L('One payment', 'دفعة واحدة') }, { value: 'rec', label: L('Recurring', 'متكررة') }, { value: 'inst', label: L('Installments', 'أقساط') }]} />
                  <Tabs value={tab} onChange={setTab} tabs={[{ value: 'all', label: L('All', 'الكل'), count: 84 }, { value: 'valid', label: L('Valid', 'صالحة'), count: 71 }, { value: 'invalid', label: L('Invalid', 'غير صالحة'), count: 6 }]} />
                  <Switch checked={sw} onChange={setSw} label={L('Email customers when Valid', 'بريد للعميل عند الاعتماد')} description={L('Includes the PDF and verification link.', 'يتضمن PDF ورابط التحقق.')} />
                  <Progress value={0.62} />
                </div>
              </Spec>
              <Spec label={L('Status', 'الحالة')}>
                <div className="flex flex-wrap gap-2">{statuses.map((s) => <StatusBadge key={s} status={s} />)}</div>
                <div className="mt-4 flex flex-wrap gap-2"><Badge tone="ok">{L('Paid', 'مدفوعة')}</Badge><Badge tone="bad">{L('Overdue', 'متأخرة')}</Badge><Badge tone="warn">{L('Part-paid', 'جزئياً')}</Badge><Badge tone="info">{L('3 installments', '٣ أقساط')}</Badge><Badge tone="accent">{L('Recurring', 'متكررة')}</Badge><Badge>EGS</Badge></div>
              </Spec>
              <Spec label={L('Feedback', 'التنبيهات')}>
                <div className="space-y-3">
                  <Callout tone="ok" title={L('Connected to ETA', 'متصل بالمصلحة')} />
                  <Callout tone="warn" title={L('Signer offline', 'التوقيع غير متصل')}>{L('Plug in the USB token.', 'وصّل التوكن.')}</Callout>
                  <Callout tone="bad" title={L('ETA marked this document Invalid', 'المستند غير صالح')} />
                  <div className="flex gap-2"><Button size="sm" onClick={() => toast({ tone: 'ok', text: L('Invoice INV-2026-00100 validated.', 'تم اعتماد الفاتورة.') })}>{L('Show toast', 'اعرض تنبيهاً')}</Button><Button size="sm" onClick={() => setModal(true)}>{L('Open dialog', 'افتح نافذة')}</Button></div>
                </div>
              </Spec>
              <Spec label={L('Data display', 'عرض البيانات')} className="md:col-span-2">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Stat label={L('Issued this month', 'المُصدر هذا الشهر')} value={money(634700, 'EGP', { compact: true })} delta="+12%" tone="ok" hint={L('vs last month', 'عن الشهر الماضي')} />
                  <div className="card p-5"><div className="text-[12.5px] text-ink-muted">{L('Trend', 'الاتجاه')}</div><Sparkline values={[3, 5, 4, 6, 7, 6, 9, 11]} className="mt-3" /></div>
                  <div className="card p-5"><StackedMeter parts={[{ label: L('Valid', 'صالحة'), value: 16, className: 'bg-ok' }, { label: L('Invalid', 'غير صالحة'), value: 1, className: 'bg-bad' }]} /></div>
                </div>
                <div className="mt-4"><BarChart height={160} data={['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((m, i) => ({ label: m, value: [1.4, 1.2, 1.3, 1.8, 0.8, 0.6][i] * 1e6 }))} format={(n) => money(n, 'EGP', { compact: true })} ariaLabel="Sample chart" highlightLast /></div>
                <div className="mt-4 rounded-card border border-line overflow-hidden"><Table><thead><tr><Th>{L('Number', 'الرقم')}</Th><Th>{L('Status', 'الحالة')}</Th><Th align="end">{L('Total', 'الإجمالي')}</Th></tr></thead><tbody>{[['INV-2026-00100', 'Valid', 52725], ['INV-2026-00081', 'Draft', 30780]].map(([n, s, v]) => <tr key={n as string}><Td className="font-medium">{n}</Td><Td><StatusBadge status={s as DocStatus} /></Td><Td align="end">{money(v as number)}</Td></tr>)}</tbody></Table></div>
              </Spec>
              <Spec label={L('Empty & loading', 'الفراغ والتحميل')}>
                <EmptyState icon={<Inbox className="size-5" />} title={L('No documents here yet', 'لا توجد مستندات')} body={L('Create an invoice or clear the filters.', 'أنشئ فاتورة أو امسح التصفية.')} action={<Button variant="primary" size="sm">{L('New invoice', 'فاتورة جديدة')}</Button>} />
                <div className="space-y-2 mt-2"><Skeleton className="h-4 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-24" /></div>
              </Spec>
              <Spec label={L('Seal (signature graphic)', 'الختم')}>
                <div className="flex flex-wrap items-center gap-6"><Stamp size={110} /><Stamp size={110} tone="ok" label="RECEIVED" sub="تم الاستلام" /><Stamp size={110} tone="gold" label="FATURA" sub="فاتورة" ring="ARABIC FIRST · " /></div>
                <p className="mt-4 text-[13px] text-ink-muted">{L('Once per marketing page, and for success moments. Never as decoration on working screens.', 'مرة لكل صفحة تسويقية ولحظات النجاح فقط.')}</p>
              </Spec>
            </div>
          </Block>

          <Block id="patterns" title={L('Patterns', 'الأنماط')}>
            <div className="grid gap-4 md:grid-cols-2">
              <Spec label={L('Pre-flight checklist', 'قائمة الفحص المسبق')}>
                <p className="text-[13px] text-ink-muted mb-3">{L('Neutral to-dos until the first submit attempt; then red. Errors block, warnings don’t.', 'مهام محايدة حتى أول محاولة إرسال ثم حمراء. الأخطاء تمنع والتحذيرات لا.')}</p>
                <ul className="space-y-2 text-[13.5px]">
                  <li className="flex gap-2"><span className="size-3.5 mt-[3px] rounded-full border-[1.5px] border-ink-subtle shrink-0" />{L('Customer name is required.', 'اسم العميل مطلوب.')}</li>
                  <li className="flex gap-2"><XCircle className="size-4 text-bad shrink-0 mt-0.5" />{L('Line 1: item code is required.', 'البند ١: كود الصنف مطلوب.')}</li>
                  <li className="flex gap-2 text-ink-muted"><span className="text-warn">▲</span>{L('POS01 is not approved yet.', 'الكود POS01 غير معتمد بعد.')}</li>
                </ul>
              </Spec>
              <Spec label={L('Lifecycle', 'دورة الحياة')}>
                <ol className="flex flex-wrap items-center gap-2 text-[13px]">{[L('Draft', 'مسودة'), L('Signed', 'موقّعة'), L('Submitted', 'مُرسلة'), L('Valid', 'صالحة')].map((s, i) => <li key={i} className="flex items-center gap-2"><span className="size-6 rounded-full bg-ok text-white grid place-items-center"><CheckCircle2 className="size-3.5" /></span>{s}{i < 3 && <span className="w-6 h-px bg-ok" />}</li>)}</ol>
              </Spec>
            </div>
          </Block>

          <Block id="voice" title={L('Voice', 'الأسلوب')} lead={L('Plain, specific, and from the user’s side of the screen.', 'واضح ومحدد ومن جهة المستخدم.')}>
            <div className="rounded-card border border-line overflow-hidden bg-surface">
              <Table>
                <thead><tr><Th>{L('Write', 'اكتب')}</Th><Th>{L('Not', 'لا تكتب')}</Th></tr></thead>
                <tbody>
                  {[[L('Sign & submit to ETA', 'توقيع وإرسال للمصلحة'), L('Process document', 'معالجة المستند')], [L('Individuals need a 14-digit national ID at EGP 50,000 or more.', 'الأفراد يحتاجون الرقم القومي عند ٥٠ ألفاً.'), L('Validation error 422', 'خطأ تحقق 422')], [L('ETA marked this document Invalid', 'المصلحة اعتبرت المستند غير صالح'), L('Oops! Something went wrong', 'عذراً! حدث خطأ ما')], [L('Cancel document', 'إلغاء المستند'), L('Are you sure?', 'هل أنت متأكد؟')]].map(([a, b], i) => <tr key={i}><Td className="text-ok">{a}</Td><Td className="text-ink-muted line-through decoration-bad/50">{b}</Td></tr>)}
                </tbody>
              </Table>
            </div>
          </Block>

          <Block id="a11y" title={L('Accessibility', 'الإتاحة')}>
            <ul className="grid gap-3 sm:grid-cols-2 text-[14px]">
              {[L('Text contrast AA in both themes, measured from tokens', 'تباين AA في السمتين'), L('Visible 2px focus ring on every interactive element', 'حلقة تركيز ظاهرة'), L('Labels above fields, errors below, never placeholder-as-label', 'التسمية فوق الحقل والخطأ تحته'), L('Status always icon + word, never colour alone', 'الحالة بأيقونة وكلمة'), L('Dialogs trap Escape and return focus', 'النوافذ تعيد التركيز'), L('Charts carry a hidden data table', 'الرسوم معها جدول بيانات'), L('Reduced-motion respected globally', 'احترام تقليل الحركة'), L('Full RTL with logical properties', 'دعم كامل من اليمين لليسار')].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="size-[18px] text-ok shrink-0 mt-0.5" />{t}</li>)}
            </ul>
          </Block>
        </div>
      </Wrap>
      <Modal open={modal} onClose={() => setModal(false)} size="sm" title={L('Cancel this document?', 'إلغاء هذا المستند؟')} footer={<><Button onClick={() => setModal(false)}>{L('Back', 'رجوع')}</Button><Button variant="danger" onClick={() => setModal(false)}>{L('Cancel document', 'إلغاء المستند')}</Button></>}>
        <p className="text-ink-muted">{L('ETA notifies the receiver, who can decline the cancellation.', 'تُخطر المصلحة المستلم ويمكنه رفض الإلغاء.')}</p>
      </Modal>
    </>
  );
}
