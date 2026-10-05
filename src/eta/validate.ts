import { PERSON_ID_THRESHOLD_EGP } from './codes';
import type { EtaDocument } from './types';

export type IssueLevel = 'error' | 'warning';
export interface Issue { level: IssueLevel; field: string; en: string; ar: string }

export interface ValidateOptions {
  now?: Date;
  /** ETA rejects documents issued too far in the past; the exact window is a document-type parameter. */
  maxBackdateDays?: number;
  personIdThreshold?: number;
  existingInternalIds?: string[];
}

const RIN = /^\d{9}$/;
const NATIONAL_ID = /^[23]\d{13}$/;

/**
 * Local pre-flight validation that mirrors the checks the ETA validators run after
 * submission (structure, core fields, issuer/receiver, references). Catching these
 * before signing saves a round-trip and an "Invalid" document on the taxpayer's record.
 */
export function preflight(doc: EtaDocument, opts: ValidateOptions = {}): Issue[] {
  const issues: Issue[] = [];
  const err = (field: string, en: string, ar: string) => issues.push({ level: 'error', field, en, ar });
  const warn = (field: string, en: string, ar: string) => issues.push({ level: 'warning', field, en, ar });
  const now = opts.now ?? new Date();
  const threshold = opts.personIdThreshold ?? PERSON_ID_THRESHOLD_EGP;

  if (!RIN.test(doc.issuer.id ?? '')) err('issuer.id', 'Issuer tax registration number must be 9 digits.', 'رقم التسجيل الضريبي للمصدر يجب أن يكون ٩ أرقام.');
  if (!doc.issuer.address?.branchID) err('issuer.address.branchID', 'Select the issuing branch.', 'اختر الفرع المُصدِر.');
  if (!doc.taxpayerActivityCode) err('taxpayerActivityCode', 'Activity code is required.', 'كود النشاط مطلوب.');
  if (!doc.internalID.trim()) err('internalID', 'Internal invoice number is required.', 'رقم الفاتورة الداخلي مطلوب.');
  if (opts.existingInternalIds?.includes(doc.internalID)) err('internalID', `Internal number ${doc.internalID} is already used.`, `الرقم الداخلي ${doc.internalID} مستخدم بالفعل.`);

  const issued = new Date(doc.dateTimeIssued);
  if (issued.getTime() > now.getTime() + 60_000) err('dateTimeIssued', 'Issue date cannot be in the future.', 'لا يمكن أن يكون تاريخ الإصدار في المستقبل.');
  const maxDays = opts.maxBackdateDays ?? 7;
  if ((now.getTime() - issued.getTime()) / 86_400_000 > maxDays)
    warn('dateTimeIssued', `Issue date is more than ${maxDays} days old; ETA may reject it.`, `تاريخ الإصدار أقدم من ${maxDays} أيام وقد ترفضه المصلحة.`);

  const r = doc.receiver;
  if (r.type === 'B') {
    if (!RIN.test(r.id ?? '')) err('receiver.id', 'Business customers need a 9-digit tax registration number.', 'العميل التجاري يحتاج رقم تسجيل ضريبي من ٩ أرقام.');
    if (!r.name) err('receiver.name', 'Customer name is required.', 'اسم العميل مطلوب.');
    if (!r.address?.street) err('receiver.address', 'Business customers need a full address.', 'العميل التجاري يحتاج عنواناً كاملاً.');
  }
  if (r.type === 'P') {
    if (doc.totalAmount >= threshold && !NATIONAL_ID.test(r.id ?? ''))
      err('receiver.id', `A 14-digit national ID is required for individuals when the total is ${threshold.toLocaleString()} EGP or more.`, `الرقم القومي (١٤ رقماً) مطلوب للأفراد عندما يبلغ الإجمالي ${threshold.toLocaleString()} جنيه أو أكثر.`);
    else if (r.id && !NATIONAL_ID.test(r.id)) err('receiver.id', 'National ID must be 14 digits.', 'الرقم القومي يجب أن يكون ١٤ رقماً.');
  }
  if (r.type === 'F') {
    if (!r.name) err('receiver.name', 'Foreign customer name is required.', 'اسم العميل الأجنبي مطلوب.');
    if (r.address?.country === 'EG') err('receiver.address.country', 'Foreign customers must have a country other than Egypt.', 'العميل الأجنبي يجب أن تكون دولته غير مصر.');
  }

  if (['C', 'D', 'EC', 'ED'].includes(doc.documentType) && !doc.references?.length)
    err('references', 'Credit and debit notes must reference the original invoice.', 'إشعارات الخصم والإضافة يجب أن تشير إلى الفاتورة الأصلية.');
  if (doc.documentType.startsWith('E') && r.type !== 'F')
    err('receiver.type', 'Export documents must be issued to a foreign receiver.', 'مستندات التصدير يجب أن تصدر لمستلم أجنبي.');

  if (!doc.invoiceLines.length) err('invoiceLines', 'Add at least one line.', 'أضف بنداً واحداً على الأقل.');
  doc.invoiceLines.forEach((l, i) => {
    const f = `invoiceLines[${i}]`;
    const n = i + 1;
    if (!l.description.trim()) err(`${f}.description`, `Line ${n}: description is required.`, `البند ${n}: الوصف مطلوب.`);
    if (!l.itemCode) err(`${f}.itemCode`, `Line ${n}: item code (EGS or GS1) is required.`, `البند ${n}: كود الصنف مطلوب.`);
    if (!(l.quantity > 0)) err(`${f}.quantity`, `Line ${n}: quantity must be greater than zero.`, `البند ${n}: الكمية يجب أن تكون أكبر من صفر.`);
    if (!(l.unitValue.amountEGP > 0)) err(`${f}.unitValue`, `Line ${n}: unit price must be greater than zero.`, `البند ${n}: سعر الوحدة يجب أن يكون أكبر من صفر.`);
    if (l.unitValue.currencySold !== 'EGP' && !(l.unitValue.currencyExchangeRate! > 0))
      err(`${f}.unitValue.currencyExchangeRate`, `Line ${n}: exchange rate is required for ${l.unitValue.currencySold}.`, `البند ${n}: سعر الصرف مطلوب لعملة ${l.unitValue.currencySold}.`);
    if (!l.taxableItems.some((t) => t.taxType === 'T1'))
      warn(`${f}.taxableItems`, `Line ${n}: no VAT (T1) line. Add T1 with an exemption subtype if the item is exempt.`, `البند ${n}: لا توجد ضريبة قيمة مضافة. أضف T1 بنوع إعفاء إذا كان الصنف معفى.`);
  });

  return issues;
}

export const hasErrors = (issues: Issue[]) => issues.some((i) => i.level === 'error');
