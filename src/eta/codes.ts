/**
 * ETA code tables. In production these are synced from the SDK code lists
 * (https://sdk.invoicing.eta.gov.eg/codes/) by the admin "Reference data" job;
 * this file is the bundled seed so the composer works offline.
 */

export type TaxKind =
  | 'vat' // T1
  | 'table-rate' // T2
  | 'table-fixed' // T3
  | 'withholding' // T4 — deducted from the line total
  | 'taxable-fee' // T5–T12 — included in the VAT base
  | 'non-taxable-fee'; // T13–T20 — added to total, outside the VAT base

export interface TaxSubType { code: string; en: string; ar: string; fixed?: boolean; defaultRate?: number }
export interface TaxType { code: string; en: string; ar: string; kind: TaxKind; subTypes: TaxSubType[] }

const fee = (code: string, en: string, ar: string, kind: TaxKind, rateSub: string, amountSub: string): TaxType => ({
  code, en, ar, kind,
  subTypes: [
    { code: rateSub, en: `${en} (percentage)`, ar: `${ar} (نسبة)` },
    { code: amountSub, en: `${en} (amount)`, ar: `${ar} (مبلغ)`, fixed: true },
  ],
});

export const TAX_TYPES: TaxType[] = [
  {
    code: 'T1', en: 'Value added tax', ar: 'ضريبة القيمة المضافة', kind: 'vat',
    subTypes: [
      { code: 'V009', en: 'General item sales', ar: 'مبيعات السلع العامة', defaultRate: 14 },
      { code: 'V001', en: 'Export', ar: 'تصدير', defaultRate: 0 },
      { code: 'V002', en: 'Export to free and other areas', ar: 'تصدير للمناطق الحرة وأخرى', defaultRate: 0 },
      { code: 'V003', en: 'Exempted good or service', ar: 'سلعة أو خدمة معفاة', defaultRate: 0 },
      { code: 'V004', en: 'Non-taxable good or service', ar: 'سلعة أو خدمة غير خاضعة', defaultRate: 0 },
      { code: 'V005', en: 'Exemptions for diplomats, consulates and embassies', ar: 'إعفاءات الدبلوماسيين والقنصليات والسفارات', defaultRate: 0 },
      { code: 'V006', en: 'Defence and national security exemptions', ar: 'إعفاءات الدفاع والأمن القومي', defaultRate: 0 },
      { code: 'V007', en: 'Agreements exemptions', ar: 'إعفاءات الاتفاقيات', defaultRate: 0 },
      { code: 'V008', en: 'Special exemptions and other reasons', ar: 'إعفاءات خاصة وأسباب أخرى', defaultRate: 0 },
      { code: 'V010', en: 'Other rates', ar: 'نسب ضريبة أخرى', defaultRate: 5 },
    ],
  },
  { code: 'T2', en: 'Table tax (percentage)', ar: 'ضريبة الجدول (نسبية)', kind: 'table-rate', subTypes: [{ code: 'Tbl01', en: 'Table tax (percentage)', ar: 'ضريبة الجدول (نسبية)' }] },
  { code: 'T3', en: 'Table tax (fixed amount)', ar: 'ضريبة الجدول (قطعية)', kind: 'table-fixed', subTypes: [{ code: 'Tbl02', en: 'Table tax (fixed amount)', ar: 'ضريبة الجدول (قطعية)', fixed: true }] },
  {
    code: 'T4', en: 'Withholding tax (WHT)', ar: 'الخصم تحت حساب الضريبة', kind: 'withholding',
    subTypes: [
      { code: 'W001', en: 'Contracting', ar: 'المقاولات', defaultRate: 1 },
      { code: 'W002', en: 'Supplies', ar: 'التوريدات', defaultRate: 1 },
      { code: 'W003', en: 'Purchases', ar: 'المشتريات', defaultRate: 1 },
      { code: 'W004', en: 'Services', ar: 'الخدمات', defaultRate: 3 },
      { code: 'W005', en: 'Car transportation by cooperative societies', ar: 'نقل السيارات بالجمعيات التعاونية', defaultRate: 1 },
      { code: 'W006', en: 'Commission agency & brokerage', ar: 'الوكالة بالعمولة والسمسرة', defaultRate: 5 },
      { code: 'W010', en: 'Professional fees', ar: 'أتعاب مهنية', defaultRate: 5 },
      { code: 'W013', en: 'Royalties', ar: 'الإتاوات', defaultRate: 5 },
      { code: 'W014', en: 'Customs clearance', ar: 'التخليص الجمركي', defaultRate: 3 },
      { code: 'W016', en: 'Advance payments', ar: 'دفعات مقدمة', defaultRate: 1 },
    ],
  },
  fee('T5', 'Stamping tax', 'ضريبة الدمغة', 'taxable-fee', 'ST01', 'ST02'),
  fee('T7', 'Entertainment tax', 'ضريبة الملاهي', 'taxable-fee', 'Ent01', 'Ent02'),
  fee('T8', 'Resource development fee', 'رسم تنمية الموارد', 'taxable-fee', 'RD01', 'RD02'),
  fee('T9', 'Service charges', 'رسم خدمة', 'taxable-fee', 'SC01', 'SC02'),
  fee('T10', 'Municipality fees', 'رسم المحليات', 'taxable-fee', 'Mn01', 'Mn02'),
  fee('T11', 'Medical insurance fee', 'رسم التأمين الصحي', 'taxable-fee', 'MI01', 'MI02'),
  fee('T12', 'Other fees', 'رسوم أخرى', 'taxable-fee', 'OF01', 'OF02'),
  fee('T13', 'Stamping tax — non-taxable', 'ضريبة الدمغة (غير خاضعة)', 'non-taxable-fee', 'ST03', 'ST04'),
  fee('T17', 'Service charges — non-taxable', 'رسم خدمة (غير خاضع)', 'non-taxable-fee', 'SC03', 'SC04'),
  fee('T20', 'Other fees — non-taxable', 'رسوم أخرى (غير خاضعة)', 'non-taxable-fee', 'OF03', 'OF04'),
];

export const taxType = (code: string) => TAX_TYPES.find((t) => t.code === code);
export const taxKind = (code: string): TaxKind | undefined => taxType(code)?.kind;

export const UNIT_TYPES = [
  { code: 'EA', en: 'Each', ar: 'وحدة' },
  { code: 'PCE', en: 'Piece', ar: 'قطعة' },
  { code: 'KGM', en: 'Kilogram', ar: 'كيلوجرام' },
  { code: 'GRM', en: 'Gram', ar: 'جرام' },
  { code: 'TNE', en: 'Tonne', ar: 'طن' },
  { code: 'LTR', en: 'Litre', ar: 'لتر' },
  { code: 'MTR', en: 'Metre', ar: 'متر' },
  { code: 'MTK', en: 'Square metre', ar: 'متر مربع' },
  { code: 'MTQ', en: 'Cubic metre', ar: 'متر مكعب' },
  { code: 'BX', en: 'Box', ar: 'صندوق' },
  { code: 'SET', en: 'Set', ar: 'طقم' },
  { code: 'HUR', en: 'Hour', ar: 'ساعة' },
  { code: 'DAY', en: 'Day', ar: 'يوم' },
  { code: 'MON', en: 'Month', ar: 'شهر' },
  { code: 'ANN', en: 'Year', ar: 'سنة' },
];

export const ACTIVITY_CODES = [
  { code: '6201', en: 'Computer programming activities', ar: 'أنشطة البرمجة الحاسوبية' },
  { code: '6202', en: 'Computer consultancy and facilities management', ar: 'الاستشارات الحاسوبية وإدارة المرافق' },
  { code: '6920', en: 'Accounting, bookkeeping and auditing; tax consultancy', ar: 'المحاسبة ومسك الدفاتر والمراجعة والاستشارات الضريبية' },
  { code: '6910', en: 'Legal activities', ar: 'الأنشطة القانونية' },
  { code: '7020', en: 'Management consultancy activities', ar: 'الاستشارات الإدارية' },
  { code: '4649', en: 'Wholesale of other household goods', ar: 'بيع الجملة للسلع المنزلية الأخرى' },
  { code: '4711', en: 'Retail sale in non-specialized stores', ar: 'البيع بالتجزئة في المتاجر غير المتخصصة' },
  { code: '4100', en: 'Construction of buildings', ar: 'تشييد المباني' },
  { code: '1071', en: 'Manufacture of bakery products', ar: 'صناعة منتجات المخابز' },
  { code: '5610', en: 'Restaurants and mobile food service', ar: 'المطاعم وخدمات الأغذية المتنقلة' },
];

export const GOVERNORATES = [
  'Cairo', 'Giza', 'Alexandria', 'Qalyubia', 'Sharqia', 'Dakahlia', 'Gharbia', 'Monufia', 'Beheira',
  'Kafr El Sheikh', 'Damietta', 'Port Said', 'Ismailia', 'Suez', 'Faiyum', 'Beni Suef', 'Minya', 'Asyut',
  'Sohag', 'Qena', 'Luxor', 'Aswan', 'Red Sea', 'New Valley', 'Matrouh', 'North Sinai', 'South Sinai',
];

export const COUNTRIES = [
  { code: 'EG', en: 'Egypt', ar: 'مصر' },
  { code: 'SA', en: 'Saudi Arabia', ar: 'السعودية' },
  { code: 'AE', en: 'United Arab Emirates', ar: 'الإمارات' },
  { code: 'BH', en: 'Bahrain', ar: 'البحرين' },
  { code: 'KW', en: 'Kuwait', ar: 'الكويت' },
  { code: 'JO', en: 'Jordan', ar: 'الأردن' },
  { code: 'GB', en: 'United Kingdom', ar: 'المملكة المتحدة' },
  { code: 'DE', en: 'Germany', ar: 'ألمانيا' },
  { code: 'US', en: 'United States', ar: 'الولايات المتحدة' },
];

export const CURRENCIES = ['EGP', 'USD', 'EUR', 'GBP', 'SAR', 'AED'];

/** Receiver identity threshold: natural-person receivers must carry a national ID
 *  once the document total reaches this amount (EGP). Admin-configurable. */
export const PERSON_ID_THRESHOLD_EGP = 50_000;
