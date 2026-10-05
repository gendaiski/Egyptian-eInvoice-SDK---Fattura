/**
 * ETA code tables, derived from the official SDK code lists bundled in ./data
 * (see ./data/README.md for source and licence). In production the admin
 * "Reference data" job re-syncs these from https://sdk.invoicing.eta.gov.eg/codes/.
 */
import activityCodes from './data/ActivityCodes.json';
import countryCodes from './data/CountryCodes.json';
import currencyCodes from './data/CurrencyCodes.json';
import nonTaxableTaxTypes from './data/NonTaxableTaxTypes.json';
import taxSubtypes from './data/TaxSubtypes.json';
import taxTypes from './data/TaxTypes.json';
import unitTypes from './data/UnitTypes.json';

export type TaxKind =
  | 'vat' // T1
  | 'table-rate' // T2
  | 'table-fixed' // T3
  | 'withholding' // T4 — deducted from the line total
  | 'taxable-fee' // T5–T12 — included in the VAT base
  | 'non-taxable-fee'; // T13–T20 — added to total, outside the VAT base

export interface TaxSubType { code: string; en: string; ar: string; fixed?: boolean; defaultRate?: number }
export interface TaxType { code: string; en: string; ar: string; kind: TaxKind; subTypes: TaxSubType[] }
export interface Coded { code: string; en: string; ar: string }

/** Display fixes for typos in the published tables. Codes are never changed. */
const TIDY: [RegExp, string][] = [
  [/Purachases/, 'Purchases'], [/Sumspaid/, 'Sums paid'], [/Commissionagency/, 'Commission agency'],
  [/Discounts&/, 'Discounts &'], [/Alldiscounts/, 'All discounts'], [/Exemptios/, 'Exemptions'], [/^advance/, 'Advance'],
  [/المبالغالتي/, 'المبالغ التي'], [/الوكالةبالعمولة/, 'الوكالة بالعمولة'], [/الخصوماتوالمنح/, 'الخصومات والمنح'],
  [/جميعالخصومات/, 'جميع الخصومات'], [/\s+/g, ' '],
];
const tidy = (s: string) => TIDY.reduce((acc, [re, to]) => acc.replace(re, to), s).trim();

/** T9 and T17 are published as "Table tax (percentage)" in English but are service charges (رسم خدمة, SC01–SC04). */
const TYPE_NAME_OVERRIDES: Record<string, { en: string }> = { T9: { en: 'Service charges' }, T17: { en: 'Service charges' } };

/** Common rates to pre-fill; the user can always change them on the line. */
const DEFAULT_RATES: Record<string, number> = {
  V001: 0, V002: 0, V003: 0, V004: 0, V005: 0, V006: 0, V007: 0, V008: 0, V009: 14, V010: 5,
  W001: 1, W002: 1, W003: 1, W004: 3, W005: 1, W006: 5, W010: 5, W011: 5, W013: 5, W014: 3, W015: 0, W016: 1,
};

/** Display order of subtypes within VAT: the everyday one first. */
const SUBTYPE_FIRST = ['V009'];

const kindOf = (code: string): TaxKind => {
  const n = Number(code.slice(1));
  if (n === 1) return 'vat';
  if (n === 2) return 'table-rate';
  if (n === 3) return 'table-fixed';
  if (n === 4) return 'withholding';
  return n <= 12 ? 'taxable-fee' : 'non-taxable-fee';
};
const FIXED_TYPES = new Set(['T3', 'T6', 'T14']);

export const TAX_TYPES: TaxType[] = [...taxTypes, ...nonTaxableTaxTypes].map((t) => ({
  code: t.Code,
  en: TYPE_NAME_OVERRIDES[t.Code]?.en ?? tidy(t.Desc_en),
  ar: tidy(t.Desc_ar),
  kind: kindOf(t.Code),
  subTypes: taxSubtypes
    .filter((s) => s.TaxtypeReference === t.Code)
    .sort((a, b) => Number(SUBTYPE_FIRST.includes(b.Code)) - Number(SUBTYPE_FIRST.includes(a.Code)))
    .map((s) => ({
      code: s.Code,
      en: tidy(s.Desc_en),
      ar: tidy(s.Desc_ar),
      fixed: FIXED_TYPES.has(t.Code) || /\(amount\)|fixed amount/i.test(s.Desc_en) || undefined,
      defaultRate: DEFAULT_RATES[s.Code],
    })),
}));

export const taxType = (code: string) => TAX_TYPES.find((t) => t.code === code);
export const taxKind = (code: string): TaxKind | undefined => taxType(code)?.kind;
export const taxSubType = (type: string, sub: string) => taxType(type)?.subTypes.find((s) => s.code === sub);

/** Arabic names for the units people actually use; the published table leaves most of them blank. */
const UNIT_AR: Record<string, string> = {
  EA: 'وحدة', C62: 'وحدة نشاط', KGM: 'كيلوجرام', GRM: 'جرام', TNE: 'طن', LTR: 'لتر', M: 'متر', MTK: 'متر مربع', MTQ: 'متر مكعب',
  CT: 'كرتونة', PK: 'عبوة', HUR: 'ساعة', DAY: 'يوم', WEE: 'أسبوع', MON: 'شهر', ANN: 'سنة', MIN: 'دقيقة',
};
const UNIT_EN: Record<string, string> = { EA: 'Each' };
const unitLabel = (s: string) => s.replace(/\s*\(\s*([^)]*?)\s*\)\s*$/, (_, abbr: string) => ` (${abbr})`).trim();

export const UNIT_TYPES: Coded[] = unitTypes.map((u) => ({
  code: u.code,
  en: UNIT_EN[u.code] ?? unitLabel(u.desc_en),
  ar: u.desc_ar || UNIT_AR[u.code] || unitLabel(u.desc_en),
}));

/** Shown first in unit pickers. */
export const COMMON_UNITS = ['EA', 'C62', 'KGM', 'GRM', 'TNE', 'LTR', 'M', 'MTK', 'MTQ', 'BOX', 'CT', 'PK', 'HUR', 'DAY', 'WEE', 'MON', 'ANN', 'JOB'];
export const isUnitType = (code: string) => unitTypes.some((u) => u.code === code);

export const ACTIVITY_CODES: Coded[] = activityCodes.map((a) => ({ code: a.code, en: a.Desc_en.trim(), ar: a.Desc_ar.trim() }));

export const COUNTRIES: Coded[] = countryCodes
  .map((c) => ({ code: c.code, en: c.Desc_en.trim(), ar: c.Desc_ar.trim() }))
  .sort((a, b) => (a.code === 'EG' ? -1 : b.code === 'EG' ? 1 : a.en.localeCompare(b.en)));

/** Most-used currencies first, then the rest of the published list. */
const TOP_CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED', 'KWD', 'CNY'];
export const CURRENCIES: string[] = [...TOP_CURRENCIES, ...currencyCodes.map((c) => c.code).filter((c) => !TOP_CURRENCIES.includes(c)).sort()];
export const currencyName = (code: string) => currencyCodes.find((c) => c.code === code)?.Desc_en ?? code;

export const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Gharbia', 'Monufia', 'Beheira',
  'Kafr El Sheikh', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'Faiyum', 'Beni Suef', 'Minya', 'Asyut',
  'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh', 'North Sinai', 'South Sinai',
];

/** Receiver identity threshold: natural-person receivers must carry a national ID
 *  once the document total reaches this amount (EGP). Admin-configurable. */
export const PERSON_ID_THRESHOLD_EGP = 50_000;
