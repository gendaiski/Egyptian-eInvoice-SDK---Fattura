import { buildInstallments, recurringRuns } from '@/billing/schedules';
import { VALIDATORS, newLongId, newUuid } from '@/eta/mockClient';
import { ACTIVITY_CODES, COUNTRIES, CURRENCIES, TAX_TYPES, UNIT_TYPES } from '@/eta/codes';
import type { DocStatus } from '@/eta/types';
import {
  computeDoc, type ApiDay, type AuditEntry, type Customer, type DB, type Doc, type DocLine, type Item, type Plan,
  type PlatformInvoice, type Receipt, type Recurring, type Tenant,
} from './model';

/** Deterministic PRNG so the demo looks the same on every reset. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seed(): DB {
  const rnd = mulberry32(20261005);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const now = new Date();
  const daysAgo = (n: number, h = 10) => { const d = new Date(now); d.setUTCDate(d.getUTCDate() - n); d.setUTCHours(h, int(0, 59), 0, 0); return d.toISOString(); };
  const day = (iso: string) => iso.slice(0, 10);
  const RIN = '100483726';

  const customers: Customer[] = [
    { id: 'c1', type: 'B', taxId: '204918337', name: 'Nile Delta Logistics S.A.E.', nameAr: 'دلتا النيل للخدمات اللوجستية', email: 'ap@ndlogistics.eg', phone: '+20 2 2735 1180', address: { country: 'EG', governate: 'Cairo', regionCity: 'New Cairo', street: '90th Street North', buildingNumber: '47' }, terms: 'net30', currency: 'EGP', createdAt: daysAgo(400) },
    { id: 'c2', type: 'B', taxId: '311204587', name: 'Alexandria Port Foods', nameAr: 'أغذية ميناء الإسكندرية', email: 'finance@apfoods.com.eg', address: { country: 'EG', governate: 'Alexandria', regionCity: 'Smouha', street: 'Fawzy Moaz', buildingNumber: '12' }, terms: 'net45', currency: 'EGP', createdAt: daysAgo(380) },
    { id: 'c3', type: 'B', taxId: '255870913', name: 'Giza Pharma Distribution', nameAr: 'الجيزة لتوزيع الأدوية', email: 'accounts@gizapharma.eg', address: { country: 'EG', governate: 'Giza', regionCity: '6th of October', street: 'Central Axis', buildingNumber: '3B' }, terms: 'net30', currency: 'EGP', createdAt: daysAgo(300) },
    { id: 'c4', type: 'B', taxId: '418662000', name: 'Sinai Stone Works', nameAr: 'سيناء لأعمال الحجر', email: 'ops@sinaistone.eg', address: { country: 'EG', governate: 'South Sinai', regionCity: 'El Tor', street: 'Coastal Road', buildingNumber: '9' }, terms: 'net15', currency: 'EGP', createdAt: daysAgo(200) },
    { id: 'c5', type: 'B', taxId: '390115264', name: 'Heliopolis Clinics Group', nameAr: 'مجموعة عيادات مصر الجديدة', email: 'billing@hcg.eg', address: { country: 'EG', governate: 'Cairo', regionCity: 'Heliopolis', street: 'El Merghany', buildingNumber: '118' }, terms: 'net30', currency: 'EGP', createdAt: daysAgo(260) },
    { id: 'c6', type: 'F', taxId: 'GB-09871234', name: 'Thames Analytics Ltd', email: 'payables@thamesanalytics.co.uk', address: { country: 'GB', governate: 'Greater London', regionCity: 'London', street: 'Bishopsgate', buildingNumber: '110' }, terms: 'net30', currency: 'USD', createdAt: daysAgo(150) },
    { id: 'c7', type: 'P', taxId: '29001011234567', name: 'Mona Abdel Rahman', nameAr: 'منى عبد الرحمن', email: 'mona.ar@gmail.com', address: { country: 'EG', governate: 'Cairo', regionCity: 'Maadi', street: 'Road 9', buildingNumber: '21' }, terms: 'receipt', currency: 'EGP', createdAt: daysAgo(90) },
    { id: 'c8', type: 'B', taxId: '527301449', name: 'Red Sea Resorts Management', nameAr: 'إدارة منتجعات البحر الأحمر', email: 'ap@rsrm.eg', address: { country: 'EG', governate: 'Red Sea', regionCity: 'Hurghada', street: 'El Kawthar', buildingNumber: '5' }, terms: 'net60', currency: 'EGP', createdAt: daysAgo(120) },
    { id: 'c9', type: 'F', taxId: 'AE-100345', name: 'Gulf Retail Holdings FZE', email: 'finance@gulfretail.ae', address: { country: 'AE', governate: 'Dubai', regionCity: 'Jebel Ali', street: 'Free Zone South', buildingNumber: 'LOB 17' }, terms: 'net30', currency: 'USD', createdAt: daysAgo(70) },
    { id: 'c10', type: 'B', taxId: '466029781', name: 'Mansoura Textile Co.', nameAr: 'شركة المنصورة للنسيج', email: 'acc@mansouratex.eg', address: { country: 'EG', governate: 'Dakahlia', regionCity: 'Mansoura', street: 'El Gomhoreya', buildingNumber: '64' }, terms: 'net30', currency: 'EGP', createdAt: daysAgo(40) },
  ];

  const vat = [{ taxType: 'T1', subType: 'V009', rate: 14 }];
  const items: Item[] = [
    { id: 'i1', name: 'ERP implementation — day rate', nameAr: 'تنفيذ نظام ERP — يومية', itemType: 'EGS', itemCode: `EG-${RIN}-IMPL01`, internalCode: 'IMPL01', gpcCode: '10005844', unitType: 'DAY', price: 9500, currency: 'EGP', taxes: [...vat, { taxType: 'T4', subType: 'W004', rate: 3 }], codeStatus: 'Approved', codeRequestedAt: daysAgo(380) },
    { id: 'i2', name: 'Cloud hosting — monthly', nameAr: 'استضافة سحابية — شهري', itemType: 'EGS', itemCode: `EG-${RIN}-HOST01`, internalCode: 'HOST01', gpcCode: '10005844', unitType: 'MON', price: 4200, currency: 'EGP', taxes: vat, codeStatus: 'Approved', codeRequestedAt: daysAgo(380) },
    { id: 'i3', name: 'Support retainer — monthly', nameAr: 'عقد دعم فني — شهري', itemType: 'EGS', itemCode: `EG-${RIN}-SUPP01`, internalCode: 'SUPP01', gpcCode: '10005844', unitType: 'MON', price: 12000, currency: 'EGP', taxes: vat, codeStatus: 'Approved', codeRequestedAt: daysAgo(350) },
    { id: 'i4', name: 'Software licence — annual seat', nameAr: 'ترخيص برنامج — مستخدم سنوي', itemType: 'EGS', itemCode: `EG-${RIN}-LIC01`, internalCode: 'LIC01', gpcCode: '10005844', unitType: 'ANN', price: 3600, currency: 'EGP', taxes: vat, codeStatus: 'Approved', codeRequestedAt: daysAgo(350) },
    { id: 'i5', name: 'Rugged handheld scanner', nameAr: 'جهاز ماسح محمول', itemType: 'GS1', itemCode: '6221234500017', internalCode: 'HW-SCN', gpcCode: '10001145', unitType: 'EA', price: 18750, currency: 'EGP', taxes: vat, codeStatus: 'Approved', codeRequestedAt: daysAgo(300) },
    { id: 'i6', name: 'Thermal receipt printer', nameAr: 'طابعة إيصالات حرارية', itemType: 'GS1', itemCode: '6221234500024', internalCode: 'HW-PRN', gpcCode: '10001145', unitType: 'EA', price: 6400, currency: 'EGP', taxes: vat, codeStatus: 'Approved', codeRequestedAt: daysAgo(300) },
    { id: 'i7', name: 'Data analytics consulting (export)', nameAr: 'استشارات تحليل البيانات (تصدير)', itemType: 'EGS', itemCode: `EG-${RIN}-DATA01`, internalCode: 'DATA01', gpcCode: '10005844', unitType: 'HUR', price: 85, currency: 'USD', taxes: [{ taxType: 'T1', subType: 'V001', rate: 0 }], codeStatus: 'Approved', codeRequestedAt: daysAgo(200) },
    { id: 'i8', name: 'On-site training — per trainee', nameAr: 'تدريب بالموقع — للمتدرب', itemType: 'EGS', itemCode: `EG-${RIN}-TRN01`, internalCode: 'TRN01', gpcCode: '10005844', unitType: 'EA', price: 2200, currency: 'EGP', taxes: vat, codeStatus: 'Approved', codeRequestedAt: daysAgo(180) },
    { id: 'i9', name: 'POS integration package', nameAr: 'حزمة ربط نقاط البيع', itemType: 'EGS', itemCode: `EG-${RIN}-POS01`, internalCode: 'POS01', gpcCode: '10005844', unitType: 'EA', price: 27000, currency: 'EGP', taxes: vat, codeStatus: 'Submitted', codeRequestedAt: daysAgo(2) },
    { id: 'i10', name: 'Legacy data migration', nameAr: 'ترحيل بيانات قديمة', itemType: 'EGS', itemCode: `EG-${RIN}-MIG01`, internalCode: 'MIG01', gpcCode: '10005844', unitType: 'EA', price: 15000, currency: 'EGP', taxes: vat, codeStatus: 'Rejected', codeRequestedAt: daysAgo(12) },
  ];

  const line = (it: Item, qty: number, discountRate = 0): DocLine => ({
    itemId: it.id, description: it.name, itemType: it.itemType, itemCode: it.itemCode, internalCode: it.internalCode,
    unitType: it.unitType, quantity: qty, unitPrice: it.price, currency: it.currency,
    exchangeRate: it.currency === 'USD' ? 48.62 : undefined, discountRate, taxes: it.taxes.map((t) => ({ ...t })),
  });
  const party = (c: Customer) => ({ type: c.type, id: c.taxId, name: c.name, address: c.address });
  const okSteps = () => VALIDATORS.map((name) => ({ name, status: 'Valid' as const }));

  const docs: Doc[] = [];
  let n = 1;
  const domestic = items.filter((i) => i.currency === 'EGP' && i.codeStatus === 'Approved');
  for (let k = 0; k < 64; k++) {
    const age = Math.floor(Math.pow(rnd(), 1.15) * 178) + 1;
    const c = pick(customers.filter((x) => x.type !== 'P'));
    const foreign = c.type === 'F';
    const lines = foreign ? [line(items[6], int(20, 160))] : Array.from({ length: int(1, 3) }, () => line(pick(domestic), int(1, 12), rnd() < 0.2 ? 5 : 0));
    let status: DocStatus = 'Valid';
    const roll = rnd();
    if (age <= 1 && roll < 0.4) status = 'Submitted';
    else if (roll < 0.06) status = 'Invalid';
    else if (roll < 0.1) status = 'Cancelled';
    else if (roll < 0.125) status = 'Rejected';
    const issuedAt = daysAgo(age, int(7, 15));
    const d: Doc = {
      id: `d${n}`, direction: 'sent', documentType: foreign ? 'EI' : 'I', internalID: `${foreign ? 'EXP' : 'INV'}-2026-${String(n).padStart(5, '0')}`,
      status, counterparty: party(c), customerId: c.id, branchId: rnd() < 0.75 ? 'b0' : 'b1', activityCode: '6201', issuedAt,
      lines, extraDiscount: 0, plan: { kind: 'one-time', terms: c.terms }, payments: [], events: [],
      uuid: newUuid(), longId: newLongId(), submissionId: newUuid(), submittedAt: issuedAt,
      validatedAt: status === 'Submitted' ? undefined : issuedAt,
      steps: status === 'Submitted' ? undefined : okSteps(),
    };
    if (status === 'Invalid') {
      d.steps = okSteps();
      const s = d.steps.find((x) => x.name === 'Code validator')!;
      s.status = 'Invalid';
      s.error = { code: 'ItemCodeNotActive', message: `Item code ${lines[0].itemCode} was not active on the issue date.`, propertyPath: 'invoiceLines[0].itemCode' };
    }
    if (status === 'Cancelled' || status === 'Rejected') {
      d.stateChangedAt = daysAgo(Math.max(0, age - 1));
      d.stateReason = status === 'Cancelled' ? 'Wrong quantity on line 1 — reissued.' : 'Purchase order number missing.';
    }
    d.events.push({ at: issuedAt, type: 'created', by: 'Yasmine Fouad' }, { at: issuedAt, type: 'signed', by: 'Signer agent · FIN-PC-02' }, { at: issuedAt, type: 'submitted', by: 'Yasmine Fouad' });
    if (d.validatedAt) d.events.push({ at: d.validatedAt, type: status === 'Invalid' ? 'invalid' : 'valid', by: 'ETA' });
    if (d.stateChangedAt) d.events.push({ at: d.stateChangedAt, type: status.toLowerCase(), by: status === 'Cancelled' ? 'Karim Nabil' : c.name, note: d.stateReason });
    if (status === 'Valid') {
      const total = computeDoc(d).totals.totalAmount;
      const termsDays = { receipt: 0, net15: 15, net30: 30, net45: 45, net60: 60 }[c.terms];
      if (age > termsDays + 4 && rnd() < 0.86) d.payments.push({ id: `p${n}`, date: day(daysAgo(Math.max(1, age - termsDays + int(-3, 6)))), amount: Math.round(total * 100) / 100, method: pick(['bank', 'bank', 'instapay', 'cheque']) });
      else if (rnd() < 0.2) d.payments.push({ id: `p${n}`, date: day(daysAgo(Math.max(1, age - 3))), amount: Math.round(total * 0.4 * 100) / 100, method: 'bank' });
    }
    docs.push(d); n++;
  }

  // Installment deals: one ETA invoice, collected over time.
  const instDeals: [string, Item, number, number, number, number][] = [
    ['c8', items[4], 12, 20, 6, 75], ['c3', items[0], 18, 0, 4, 40], ['c7', items[5], 1, 25, 3, 20],
  ];
  for (const [cid, it, qty, down, count, age] of instDeals) {
    const c = customers.find((x) => x.id === cid)!;
    const issuedAt = daysAgo(age);
    const plan = { kind: 'installments' as const, count, frequency: 'monthly' as const, firstDueDate: day(issuedAt), downPaymentPct: down };
    const d: Doc = {
      id: `d${n}`, direction: 'sent', documentType: 'I', internalID: `INV-2026-${String(n).padStart(5, '0')}`, status: 'Valid',
      counterparty: party(c), customerId: c.id, branchId: 'b0', activityCode: '6201', issuedAt, lines: [line(it, qty)], extraDiscount: 0,
      plan, payments: [], events: [{ at: issuedAt, type: 'created', by: 'Karim Nabil' }, { at: issuedAt, type: 'valid', by: 'ETA' }],
      uuid: newUuid(), longId: newLongId(), submissionId: newUuid(), submittedAt: issuedAt, validatedAt: issuedAt, steps: okSteps(),
    };
    const total = computeDoc(d).totals.totalAmount;
    d.installments = buildInstallments(total, plan).map((r) => ({ ...r, paid: 0 }));
    const today = day(now.toISOString());
    for (const row of d.installments) {
      if (row.dueDate < today && !(cid === 'c3' && row === d.installments[d.installments.length - 3])) {
        row.paid = row.amount;
        d.payments.push({ id: `p${n}-${row.n}`, date: row.dueDate, amount: row.amount, method: 'bank', note: row.label === 'down' ? 'Down payment' : `Installment ${row.n}` });
      }
    }
    docs.push(d); n++;
  }

  // Recurring templates and the invoices they generated.
  const recurring: Recurring[] = [
    { id: 'r1', name: 'Nile Delta — support retainer', customerId: 'c1', lines: [line(items[2], 1)], branchId: 'b0', plan: { kind: 'recurring', frequency: 'monthly', interval: 1, startDate: day(daysAgo(150)), end: { type: 'never' }, delivery: 'submit_email', terms: 'net30' }, status: 'active', generatedIds: [], createdAt: daysAgo(152) },
    { id: 'r2', name: 'Heliopolis Clinics — hosting', customerId: 'c5', lines: [line(items[1], 3)], branchId: 'b0', plan: { kind: 'recurring', frequency: 'monthly', interval: 1, startDate: day(daysAgo(95)), end: { type: 'after', count: 12 }, delivery: 'submit', terms: 'net30' }, status: 'active', generatedIds: [], createdAt: daysAgo(96) },
    { id: 'r3', name: 'Mansoura Textile — licences', customerId: 'c10', lines: [line(items[3], 25)], branchId: 'b1', plan: { kind: 'recurring', frequency: 'quarterly', interval: 1, startDate: day(daysAgo(35)), end: { type: 'never' }, delivery: 'draft', terms: 'net30' }, status: 'active', generatedIds: [], createdAt: daysAgo(36) },
    { id: 'r4', name: 'Sinai Stone — maintenance', customerId: 'c4', lines: [line(items[2], 1, 10)], branchId: 'b0', plan: { kind: 'recurring', frequency: 'monthly', interval: 1, startDate: day(daysAgo(120)), end: { type: 'never' }, delivery: 'submit', terms: 'net15' }, status: 'paused', generatedIds: [], createdAt: daysAgo(121) },
  ];
  for (const r of recurring) {
    const today = day(now.toISOString());
    const runs = recurringRuns(r.plan, 50).filter((x) => x <= today);
    const c = customers.find((x) => x.id === r.customerId)!;
    for (const run of r.status === 'paused' ? runs.slice(0, 2) : runs) {
      const issuedAt = `${run}T08:00:00.000Z`;
      const age = (now.getTime() - new Date(issuedAt).getTime()) / 86_400_000;
      const d: Doc = {
        id: `d${n}`, direction: 'sent', documentType: 'I', internalID: `INV-2026-${String(n).padStart(5, '0')}`, status: r.plan.delivery === 'draft' && age < 3 ? 'Draft' : 'Valid',
        counterparty: party(c), customerId: c.id, branchId: r.branchId, activityCode: '6201', issuedAt, lines: r.lines.map((l) => ({ ...l, taxes: l.taxes.map((t) => ({ ...t })) })),
        extraDiscount: 0, plan: { kind: 'one-time', terms: r.plan.terms }, payments: [], recurringId: r.id,
        events: [{ at: issuedAt, type: 'generated', by: `Recurring · ${r.name}` }],
      };
      if (d.status === 'Valid') {
        Object.assign(d, { uuid: newUuid(), longId: newLongId(), submissionId: newUuid(), submittedAt: issuedAt, validatedAt: issuedAt, steps: okSteps() });
        d.events.push({ at: issuedAt, type: 'valid', by: 'ETA' });
        if (age > 20) d.payments.push({ id: `p${n}`, date: day(daysAgo(Math.floor(age) - 18)), amount: computeDoc(d).totals.totalAmount, method: 'bank' });
      }
      r.generatedIds.push(d.id); r.lastRun = run; docs.push(d); n++;
    }
    r.nextRun = r.status === 'active' ? recurringRuns(r.plan, 1, day(new Date(now.getTime() + 86_400_000).toISOString()))[0] : undefined;
  }

  // Drafts in progress.
  docs.push({
    id: `d${n}`, direction: 'sent', documentType: 'I', internalID: `INV-2026-${String(n).padStart(5, '0')}`, status: 'Draft', counterparty: party(customers[1]), customerId: 'c2',
    branchId: 'b0', activityCode: '6201', issuedAt: now.toISOString(), lines: [line(items[7], 14), line(items[3], 14)], extraDiscount: 0, plan: { kind: 'one-time', terms: 'net45' }, payments: [],
    events: [{ at: daysAgo(0, 8), type: 'created', by: 'Yasmine Fouad' }],
  }); n++;
  docs.push({
    id: `d${n}`, direction: 'sent', documentType: 'I', internalID: `INV-2026-${String(n).padStart(5, '0')}`, status: 'Draft', counterparty: party(customers[3]), customerId: 'c4',
    branchId: 'b0', activityCode: '6201', issuedAt: now.toISOString(), lines: [line(items[8], 1)], extraDiscount: 0, plan: { kind: 'one-time', terms: 'net15' }, payments: [],
    events: [{ at: daysAgo(1, 13), type: 'created', by: 'Karim Nabil' }],
  }); n++;

  // A credit note against an earlier valid invoice.
  const orig = docs.find((d) => d.status === 'Valid' && d.customerId === 'c1' && d.documentType === 'I')!;
  docs.push({
    id: `d${n}`, direction: 'sent', documentType: 'C', internalID: 'CN-2026-00001', status: 'Valid', counterparty: orig.counterparty, customerId: 'c1', branchId: 'b0', activityCode: '6201',
    issuedAt: daysAgo(6), lines: [{ ...orig.lines[0], quantity: 1 }], extraDiscount: 0, references: [orig.uuid!], plan: { kind: 'one-time', terms: 'receipt' }, payments: [],
    uuid: newUuid(), longId: newLongId(), submissionId: newUuid(), submittedAt: daysAgo(6), validatedAt: daysAgo(6), steps: okSteps(),
    events: [{ at: daysAgo(6), type: 'created', by: 'Karim Nabil', note: `Credit against ${orig.internalID}` }, { at: daysAgo(6), type: 'valid', by: 'ETA' }],
  }); n++;

  // Received (purchase) documents.
  const suppliers = [
    { type: 'B' as const, id: '200017745', name: 'Vodafone Egypt Telecommunications', address: { country: 'EG', governate: 'Giza', regionCity: 'Smart Village', street: 'Cairo-Alex Desert Rd', buildingNumber: 'B7' } },
    { type: 'B' as const, id: '100233658', name: 'Raya Distribution', address: { country: 'EG', governate: 'Giza', regionCity: '6th of October', street: 'Industrial Zone', buildingNumber: '22' } },
    { type: 'B' as const, id: '205571904', name: 'Cairo Office Supplies', address: { country: 'EG', governate: 'Cairo', regionCity: 'Downtown', street: 'Sherif', buildingNumber: '8' } },
    { type: 'B' as const, id: '318842200', name: 'Egypt Data Centers S.A.E.', address: { country: 'EG', governate: 'Cairo', regionCity: 'New Cairo', street: 'Road 90', buildingNumber: '5' } },
  ];
  const receivedLines: DocLine[] = [
    { description: 'Corporate mobile plan', itemType: 'EGS', itemCode: 'EG-200017745-CORP', unitType: 'MON', quantity: 1, unitPrice: 6800, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }, { taxType: 'T8', subType: 'RD01', rate: 8 }] },
    { description: 'Laptop 14" i7 / 16GB', itemType: 'GS1', itemCode: '6223001234567', unitType: 'EA', quantity: 3, unitPrice: 52000, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }] },
    { description: 'A4 paper, 80gsm', itemType: 'GS1', itemCode: '6224008812340', unitType: 'BOX', quantity: 20, unitPrice: 1150, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }] },
    { description: 'Colocation rack — monthly', itemType: 'EGS', itemCode: 'EG-318842200-RACK', unitType: 'MON', quantity: 1, unitPrice: 21000, currency: 'EGP', taxes: [{ taxType: 'T1', subType: 'V009', rate: 14 }] },
  ];
  for (let k = 0; k < 16; k++) {
    const si = k % 4;
    const age = int(0, 120);
    let status: DocStatus = 'Valid';
    let pending: Doc['pending'];
    if (k === 2) status = 'Rejected';
    if (k === 5) pending = 'cancellation_requested';
    if (k === 9) status = 'Cancelled';
    const issuedAt = daysAgo(k === 5 || k === 0 ? 1 : age);
    docs.push({
      id: `d${n}`, direction: 'received', documentType: 'I', internalID: `${suppliers[si].name.split(' ')[0].toUpperCase()}-${int(10000, 99999)}`, status, pending,
      counterparty: suppliers[si], branchId: 'b0', activityCode: pick(['6110', '4651', '4762', '6311']), issuedAt, lines: [{ ...receivedLines[si], taxes: receivedLines[si].taxes.map((t) => ({ ...t })) }], extraDiscount: 0,
      plan: { kind: 'one-time', terms: 'net30' }, payments: [], uuid: newUuid(), longId: newLongId(), submittedAt: issuedAt, validatedAt: issuedAt, steps: okSteps(),
      stateReason: status === 'Rejected' ? 'Delivered quantity was 15 boxes, not 20.' : undefined, stateChangedAt: status !== 'Valid' ? issuedAt : undefined,
      events: [{ at: issuedAt, type: 'received', by: suppliers[si].name }],
    });
    n++;
  }

  const submissions = docs.filter((d) => d.direction === 'sent' && d.submissionId).slice(-40).map((d, i) => ({
    id: d.submissionId!, at: d.submittedAt!, docIds: [d.id], accepted: 1, rejected: 0,
    status: d.status === 'Invalid' ? 'Invalid' as const : d.status === 'Submitted' ? 'InProgress' as const : 'Valid' as const, ms: 600 + ((i * 137) % 900), by: i % 3 ? 'Yasmine Fouad' : 'Recurring scheduler',
  })).sort((a, b) => b.at.localeCompare(a.at));

  const receipts: Receipt[] = Array.from({ length: 36 }, (_, i) => {
    const total = Math.round((150 + rnd() * 4800) * 100) / 100;
    return {
      id: `rc${i}`, number: `POS1-${String(52000 + i)}`, uuid: Array.from({ length: 64 }, () => '0123456789abcdef'[int(0, 15)]).join(''),
      at: daysAgo(Math.floor(i / 6), int(9, 21)), branchId: 'b1', device: i % 2 ? 'POS-SN-77812' : 'POS-SN-77813', type: i === 7 ? 'R' : 'S',
      buyerType: 'P', total, vat: Math.round((total * 14) / 114 * 100) / 100, method: pick(['C', 'C', 'V', 'W']), status: i === 3 ? 'Invalid' : i < 2 ? 'Submitted' : 'Valid',
    };
  });

  /* ---------- Platform admin data ---------- */
  const plans: Plan[] = [
    { id: 'starter', name: 'Starter', nameAr: 'البداية', blurb: { en: 'For freelancers and small shops getting compliant.', ar: 'للمستقلين والمتاجر الصغيرة.' }, docsPerMonth: 150, users: 2, branches: 1, monthly: 450, yearly: 4500, oneTime: 11000, installments: { count: 3, amount: 1550 }, active: true,
      features: [{ en: 'Invoices, credit & debit notes', ar: 'فواتير وإشعارات خصم وإضافة' }, { en: 'USB token signing', ar: 'توقيع بالتوكن' }, { en: 'Email support', ar: 'دعم بالبريد' }] },
    { id: 'growth', name: 'Growth', nameAr: 'النمو', blurb: { en: 'For SMEs with recurring billing and receivables.', ar: 'للشركات الصغيرة والمتوسطة.' }, docsPerMonth: 1500, users: 10, branches: 5, monthly: 1450, yearly: 14500, oneTime: 36000, installments: { count: 6, amount: 2500 }, featured: true, active: true,
      features: [{ en: 'Recurring & installment plans', ar: 'الفواتير المتكررة والتقسيط' }, { en: 'Bulk submit & CSV import', ar: 'إرسال جماعي واستيراد CSV' }, { en: 'Received-documents inbox', ar: 'صندوق المستندات الواردة' }, { en: 'Priority support (Arabic & English)', ar: 'دعم ذو أولوية' }] },
    { id: 'scale', name: 'Scale', nameAr: 'التوسع', blurb: { en: 'For multi-branch companies, POS and ERP integration.', ar: 'للشركات متعددة الفروع ونقاط البيع.' }, docsPerMonth: 20000, users: 50, branches: 50, monthly: 4900, yearly: 49000, oneTime: 120000, installments: { count: 12, amount: 4300 }, active: true,
      features: [{ en: 'E-receipts (POS) up to 20 devices', ar: 'إيصالات إلكترونية حتى ٢٠ جهاز' }, { en: 'HSM / cloud signing', ar: 'توقيع سحابي / HSM' }, { en: 'REST API & webhooks', ar: 'واجهة برمجة وWebhooks' }, { en: 'Dedicated success manager', ar: 'مدير نجاح مخصص' }] },
  ];
  const tenantNames = ['Lawtech Labs (demo)', 'Delta Agro Exports', 'Cairo Dental Partners', 'Zamalek Fine Bakery', 'Suez Marine Services', 'Aswan Granite Co.', 'Nasr City Electronics', 'Luxor Heritage Tours', 'Port Said Trading', 'Tanta Pharma Retail', 'Maadi Architects', 'October Plastics', 'Faiyum Organic Farms', 'Ismailia Auto Parts', 'Hurghada Dive Centers', 'Giza Law Chambers', 'Sohag Textiles', 'New Capital Realty', 'Damietta Furniture House', 'Minya Cement Supplies', 'Beni Suef Logistics', 'Qena Sugar Traders', 'Matrouh Olive Oil', 'Sheikh Zayed Clinics'];
  const govs = ['Cairo', 'Giza', 'Alexandria', 'Suez', 'Aswan', 'Luxor', 'Port Said', 'Gharbia', 'Faiyum', 'Ismailia', 'Red Sea', 'Sohag', 'Damietta', 'Minya', 'Beni Suef', 'Qena', 'Matrouh'];
  const tenants: Tenant[] = tenantNames.map((name, i) => {
    const plan = i === 0 ? plans[1] : pick(plans);
    const model = i === 0 ? 'recurring' : pick(['recurring', 'recurring', 'recurring', 'installments', 'one-time'] as const);
    const cycle = model === 'recurring' ? pick(['monthly', 'yearly'] as const) : undefined;
    const status = i === 0 ? 'active' : pick(['active', 'active', 'active', 'active', 'trial', 'past_due', 'suspended'] as const);
    const mrr = model === 'recurring' ? (cycle === 'monthly' ? plan.monthly : Math.round(plan.yearly / 12)) : model === 'installments' ? Math.round((plan.installments.amount * plan.installments.count) / 12) : 0;
    return {
      id: `t${i + 1}`, name, rin: String(100000000 + int(0, 899999999)), owner: i === 0 ? 'aelgendy@thelawtechlabs.com' : `finance@${name.toLowerCase().replace(/[^a-z]+/g, '')}.eg`,
      governorate: i === 0 ? 'Cairo' : pick(govs), planId: plan.id, model, cycle, status, env: status === 'trial' ? 'preprod' : 'production',
      docsThisMonth: status === 'suspended' ? 0 : Math.floor(plan.docsPerMonth * (0.15 + rnd() * 0.8)), invalidRate: Math.round(rnd() * 60) / 10,
      signer: rnd() < 0.85 ? 'online' : 'offline', mrr: status === 'trial' || status === 'suspended' ? 0 : mrr, createdAt: daysAgo(int(10, 540)),
      installmentsPaid: model === 'installments' ? int(1, plan.installments.count) : undefined,
    };
  });
  const invoices: PlatformInvoice[] = [];
  let pn = 1;
  for (const t of tenants.filter((x) => x.status !== 'trial')) {
    const plan = plans.find((p) => p.id === t.planId)!;
    const rows = t.model === 'recurring' ? (t.cycle === 'monthly' ? 4 : 1) : t.model === 'installments' ? t.installmentsPaid! + 1 : 1;
    for (let k = 0; k < rows; k++) {
      const age = t.model === 'recurring' && t.cycle === 'monthly' ? k * 30 + int(0, 4) : t.model === 'installments' ? (rows - 1 - k) * 30 + 2 : int(20, 200);
      const amount = t.model === 'recurring' ? (t.cycle === 'monthly' ? plan.monthly : plan.yearly) : t.model === 'installments' ? plan.installments.amount : plan.oneTime;
      const last = k === (t.model === 'installments' ? rows - 1 : 0);
      const status = t.status === 'past_due' && last ? 'overdue' : t.status === 'suspended' && last ? 'void' : t.model === 'installments' && last ? 'open' : 'paid';
      invoices.push({
        id: `pi${pn}`, number: `FAT-2026-${String(pn).padStart(4, '0')}`, tenantId: t.id, issuedAt: daysAgo(age), dueAt: day(daysAgo(age - 14)), amount, vat: Math.round(amount * 0.14 * 100) / 100,
        model: t.model, installment: t.model === 'installments' ? `${k + 1}/${plan.installments.count}` : undefined, status, etaStatus: 'Valid',
      });
      pn++;
    }
  }
  invoices.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
  const actions = ['tenant.signin', 'document.submit', 'document.cancel', 'integration.update_credentials', 'plan.change', 'member.invite', 'signer.certificate_renewed', 'admin.impersonate', 'billing.payment_received', 'codes.request'];
  const audit: AuditEntry[] = Array.from({ length: 60 }, (_, i) => {
    const t = pick(tenants);
    const action = pick(actions);
    return { id: `a${i}`, at: daysAgo(Math.floor(i / 5), int(6, 22)), actor: action.startsWith('admin') ? 'support@fatura.eg' : t.owner, tenantId: t.id, action, target: action.startsWith('document') ? `INV-2026-${String(int(1, 900)).padStart(5, '0')}` : t.name, ip: `41.${int(32, 47)}.${int(0, 255)}.${int(1, 254)}` };
  }).sort((a, b) => b.at.localeCompare(a.at));
  const api: ApiDay[] = Array.from({ length: 30 }, (_, i) => {
    const date = day(daysAgo(29 - i));
    const weekday = new Date(date).getUTCDay();
    const base = weekday === 5 ? 900 : weekday === 6 ? 1400 : 3200 + i * 40;
    const submitted = Math.floor(base * (0.9 + rnd() * 0.25));
    const invalid = Math.floor(submitted * (0.01 + rnd() * 0.03));
    const errors = i === 19 ? 214 : Math.floor(rnd() * 25);
    return { date, submitted, valid: submitted - invalid, invalid, errors, p95: i === 19 ? 4100 : Math.floor(700 + rnd() * 600) };
  });

  return {
    version: 2,
    session: { signedIn: true, onboarded: true, user: { name: 'Yasmine Fouad', email: 'yasmine@lawtechlabs.eg' } },
    company: {
      name: 'Lawtech Labs Egypt LLC', nameAr: 'لوتك لابز مصر ش.ذ.م.م', rin: RIN, activityCode: '6201', email: 'billing@lawtechlabs.eg', phone: '+20 2 2461 0090',
      iban: 'EG380019000500000000263180002', bankName: 'Commercial International Bank (CIB)',
      branches: [
        { id: 'b0', code: '0', name: 'Head office — New Cairo', nameAr: 'المقر الرئيسي — القاهرة الجديدة', address: { country: 'EG', governate: 'Cairo', regionCity: 'New Cairo', street: 'South 90th Street', buildingNumber: '211', floor: '4' } },
        { id: 'b1', code: '1', name: 'Alexandria branch', nameAr: 'فرع الإسكندرية', address: { country: 'EG', governate: 'Alexandria', regionCity: 'San Stefano', street: 'El Geish Road', buildingNumber: '399' } },
      ],
    },
    integration: { env: 'production', clientId: '8d1c4e2a-73b9-4f0e-9c55-1a2b3c4d5e6f', secretSet: true, status: 'connected', lastTokenAt: daysAgo(0, 9), posSerial: 'POS-SN-77812' },
    signing: {
      method: 'usb-token',
      agent: { status: 'online', version: '2.4.1', host: 'FIN-PC-02', lastSeen: new Date(now.getTime() - 40_000).toISOString() },
      certificate: { subject: 'CN=Lawtech Labs Egypt LLC, SERIALNUMBER=100483726', issuer: 'Egypt Trust Sub CA', serial: '4F 1A 77 0C 9E 21', expires: day(new Date(now.getTime() + 41 * 86_400_000).toISOString()) },
    },
    settings: {
      numbering: { I: { pattern: 'INV-{YYYY}-{#####}', next: n + 1 }, C: { pattern: 'CN-{YYYY}-{#####}', next: 2 }, D: { pattern: 'DN-{YYYY}-{#####}', next: 1 }, EI: { pattern: 'EXP-{YYYY}-{#####}', next: 1 } },
      personIdThreshold: 50_000, defaultTerms: 'net30', autoEmail: true,
    },
    customers, items, docs: docs.sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)), recurring, submissions, receipts,
    members: [
      { id: 'm1', name: 'Ahmed El Gendy', email: 'aelgendy@thelawtechlabs.com', role: 'Owner', status: 'active', lastActive: daysAgo(0, 9) },
      { id: 'm2', name: 'Yasmine Fouad', email: 'yasmine@lawtechlabs.eg', role: 'Accountant', status: 'active', lastActive: daysAgo(0, 11) },
      { id: 'm3', name: 'Karim Nabil', email: 'karim@lawtechlabs.eg', role: 'Admin', status: 'active', lastActive: daysAgo(1, 15) },
      { id: 'm4', name: 'Salma Hassan', email: 'salma@lawtechlabs.eg', role: 'Sales', status: 'active', lastActive: daysAgo(3, 12) },
      { id: 'm5', name: 'Omar Tarek', email: 'omar@lawtechlabs.eg', role: 'Viewer', status: 'invited' },
    ],
    notices: [
      { id: 'n1', at: daysAgo(0, 9), tone: 'warn', text: { en: 'Raya Distribution requested to cancel a document you received.', ar: 'طلبت راية للتوزيع إلغاء مستند مستلم.' }, to: '/app/received', read: false },
      { id: 'n2', at: daysAgo(0, 8), tone: 'info', text: { en: 'Recurring invoice for Mansoura Textile is waiting for approval.', ar: 'فاتورة متكررة لشركة المنصورة للنسيج بانتظار الاعتماد.' }, to: '/app/documents?status=Draft', read: false },
      { id: 'n3', at: daysAgo(1, 16), tone: 'bad', text: { en: 'Item code MIG01 was rejected by ETA.', ar: 'رفضت المصلحة كود الصنف MIG01.' }, to: '/app/items', read: false },
      { id: 'n4', at: daysAgo(2, 10), tone: 'warn', text: { en: 'Your signing certificate expires in 41 days.', ar: 'شهادة التوقيع تنتهي خلال ٤١ يوماً.' }, to: '/app/settings/signing', read: true },
    ],
    admin: {
      plans, tenants, invoices, audit, api,
      users: [
        { id: 'u1', name: 'Ahmed El Gendy', email: 'aelgendy@thelawtechlabs.com', role: 'Super admin', mfa: true, lastActive: daysAgo(0, 10) },
        { id: 'u2', name: 'Nour Samir', email: 'nour@fatura.eg', role: 'Support', mfa: true, lastActive: daysAgo(0, 12) },
        { id: 'u3', name: 'Hany Adel', email: 'hany@fatura.eg', role: 'Finance', mfa: true, lastActive: daysAgo(2, 9) },
        { id: 'u4', name: 'Dina Mostafa', email: 'dina@fatura.eg', role: 'Read-only', mfa: false, lastActive: daysAgo(9, 9) },
      ],
      refs: [
        { id: 'tax', name: { en: 'Tax types & subtypes', ar: 'أنواع الضرائب' }, source: '/codes/tax-types', count: TAX_TYPES.reduce((s, t) => s + t.subTypes.length, 0), syncedAt: daysAgo(0, 3), status: 'ok' },
        { id: 'unit', name: { en: 'Unit types', ar: 'وحدات القياس' }, source: '/codes/unit-types', count: UNIT_TYPES.length, syncedAt: daysAgo(0, 3), status: 'ok' },
        { id: 'activity', name: { en: 'Activity codes', ar: 'أكواد الأنشطة' }, source: '/codes/activity-types', count: ACTIVITY_CODES.length, syncedAt: daysAgo(0, 3), status: 'ok' },
        { id: 'country', name: { en: 'Country codes', ar: 'أكواد الدول' }, source: '/codes/country-codes', count: COUNTRIES.length, syncedAt: daysAgo(0, 3), status: 'ok' },
        { id: 'currency', name: { en: 'Currencies', ar: 'العملات' }, source: '/codes/currencies', count: CURRENCIES.length, syncedAt: daysAgo(0, 3), status: 'ok' },
        { id: 'doctype', name: { en: 'Document types & workflow windows', ar: 'أنواع المستندات' }, source: '/api/v1.0/documenttypes', count: 4, syncedAt: daysAgo(0, 3), status: 'ok' },
        { id: 'gpc', name: { en: 'GS1 / GPC classification', ar: 'تصنيف GS1 / GPC' }, source: '/codes/gpc', count: 4851, syncedAt: daysAgo(8, 3), status: 'stale' },
      ],
    },
  };
}
