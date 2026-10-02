/**
 * Standalone ZATCA sandbox test using the `zatca-sdk` package (real signing, hash, QR).
 * It does NOT use your DB or your onboarding.service.ts - it only checks that the SDK
 * produces invoices the ZATCA sandbox accepts.
 *
 * Install:  npm i zatca-sdk
 * Run:      npx tsx src/modules/zatca/sdk.sandbox.test.ts
 * (zatca-sdk is ESM-only, so use tsx instead of ts-node for this file)
 */
import { randomUUID } from 'node:crypto';
import { ZATCAClient, type EGSUnitInfo, type Invoice } from 'zatca-sdk';

const OTP = process.env.ZATCA_OTP || '123345'; // any value works on the sandbox
const INITIAL_PIH =
  'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

const egsUnit: EGSUnitInfo = {
  uuid: randomUUID(),
  branchName: 'Riyadh Branch',
  branchIndustry: 'Supply activities',
  location: 'RRRD2929',
  commonName: 'TST-886431145-399999999900003',
  organizationName: 'Maximum Speed Tech Supply LTD',
  countryCode: 'SA',
  vatNumber: '399999999900003',
  invoiceType: '1100', // standard + simplified
};

const seller: Invoice['seller'] = {
  registrationName: 'Maximum Speed Tech Supply LTD',
  vatNumber: '399999999900003',
  identification: { schemeId: 'CRN', value: '1010010000' },
  address: {
    street: 'Prince Sultan',
    buildingNumber: '1234',
    citySubdivision: 'Al Murabba',
    city: 'Riyadh',
    postalCode: '12345',
    country: 'SA',
  },
};

const buyer: Invoice['buyer'] = {
  registrationName: 'Test Buyer',
  vatNumber: '399999999800003',
  address: {
    street: 'King Fahd',
    buildingNumber: '5678',
    citySubdivision: 'Al Olaya',
    city: 'Riyadh',
    postalCode: '12211',
    country: 'SA',
  },
};

type Kind = 'STANDARD' | 'SIMPLIFIED' | 'CREDIT' | 'DEBIT';

function buildInvoice(kind: Kind, n: number): Invoice {
  const now = new Date();
  const isSimplified = kind === 'SIMPLIFIED';
  const isNote = kind === 'CREDIT' || kind === 'DEBIT';
  const date = now.toISOString().slice(0, 10);

  return {
    id: `SDK-${kind}-${n}`,
    uuid: randomUUID(),
    issueDate: date,
    issueTime: now.toISOString().slice(11, 19),
    invoiceTypeCode: kind === 'CREDIT' ? '381' : kind === 'DEBIT' ? '383' : '388',
    invoiceSubType: isSimplified ? '0200000' : '0100000',
    documentCurrency: 'SAR',
    taxCurrency: 'SAR',
    // The client sets the real ICV / PIH chain; these are just placeholders for the type.
    invoiceCounterValue: n,
    previousInvoiceHash: INITIAL_PIH,
    billingReference: isNote ? { invoiceId: 'SDK-STANDARD-1' } : undefined,
    creditDebitReason: isNote ? 'Return of goods' : undefined,
    seller,
    buyer: isSimplified ? undefined : buyer,
    actualDeliveryDate: isSimplified ? undefined : date,
    paymentMeansCode: '10',
    lineExtensionAmount: 100,
    taxExclusiveAmount: 100,
    taxInclusiveAmount: 115,
    payableAmount: 115,
    taxTotal: 15,
    taxSubtotals: [{ taxableAmount: 100, taxAmount: 15, taxCategory: 'S', taxPercent: 15 }],
    lines: [
      {
        id: '1',
        name: 'Test Item',
        quantity: 1,
        unitCode: 'PCE',
        unitPrice: 100,
        lineTotal: 100,
        vatCategory: 'S',
        vatPercent: 15,
        vatAmount: 15,
      },
    ],
  } as Invoice;
}

function fail(step: string, error: unknown): never {
  console.error(`\n❌ ${step} failed:`, error);
  process.exit(1);
}

async function main() {
  console.log('=== zatca-sdk sandbox test ===\n');
  const client = new ZATCAClient({ env: 'sandbox', egsUnit, solutionName: 'MaxSpeed' });

  // 1. Keys + CSR + compliance CSID
  console.log('⏳ Onboarding step 1: keys + CSR + compliance CSID...');
  const start = await client.startOnboarding(OTP);
  if (!start.success) fail('startOnboarding', start.error);
  console.log('✅ Compliance CSID acquired.');

  // 2. Compliance checks (one per document kind)
  const kinds: Kind[] = ['STANDARD', 'SIMPLIFIED', 'CREDIT', 'DEBIT'];
  let allOk = true;
  for (const [i, kind] of kinds.entries()) {
    console.log(`\n⏳ Compliance check: ${kind}...`);
    const res = await client.checkInvoiceCompliance(buildInvoice(kind, i + 1));
    if (!res.success) {
      allOk = false;
      console.log(`❌ ${kind}:`, res.error);
      continue;
    }
    const v = res.data;
    const errors = v.errorMessages ?? [];
    const warnings = v.warningMessages ?? [];
    if (errors.length) allOk = false;
    console.log(`${errors.length ? '❌' : '✅'} ${kind}: ${errors.length} errors, ${warnings.length} warnings`);
    for (const e of errors) console.log(`   ERROR   ${e.code}: ${e.message}`);
    for (const w of warnings) console.log(`   WARNING ${w.code}: ${w.message}`);
  }

  // 3. Production CSID
  console.log('\n⏳ Onboarding step 2: production CSID...');
  const fin = await client.finishOnboarding();
  if (!fin.success) fail('finishOnboarding', fin.error);
  console.log('✅ Production CSID acquired.');

  // 4. Real submissions: simplified = reporting, standard = clearance
  for (const kind of ['SIMPLIFIED', 'STANDARD'] as const) {
    console.log(`\n⏳ Submitting ${kind} invoice...`);
    const sub = await client.submitInvoice(buildInvoice(kind, 10));
    if (!sub.success) {
      console.log(`❌ ${kind}:`, sub.error);
      continue;
    }
    console.log(`${sub.data.accepted ? '✅' : '❌'} ${kind} ${sub.data.type}: accepted=${sub.data.accepted}`);
    if (!sub.data.accepted) console.log('   ', sub.data.error);
    else console.log('   hash:', sub.data.signedInvoice.invoiceHash);
  }

  console.log(`\n=== Compliance checks overall: ${allOk ? '✅ ALL PASSED' : '❌ SOME FAILED'} ===`);
}

main().catch((e) => fail('unexpected error', e));
