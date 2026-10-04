import { prisma } from '../../config/database';
import { encryptSecret, decryptSecret } from './utils/crypto';
import { randomUUID } from 'crypto';

// Dynamic import for ESM package 'zatca-sdk'
// Using Function to prevent ts-node/tsc from downleveling import() to require()
const dynamicImport = new Function('specifier', 'return import(specifier)');
let ZATCAClientMod: any = null;
async function getZATCAClient() {
  if (!ZATCAClientMod) {
    ZATCAClientMod = await dynamicImport('zatca-sdk');
  }
  return ZATCAClientMod.ZATCAClient;
}

// --- MOCK INVOICES FROM sdk.sandbox.test.mts ---
const INITIAL_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

const seller = {
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

const buyer = {
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

function buildInvoice(kind: Kind, n: number) {
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
  };
}

// --- STATE MANAGEMENT ---
async function loadClient(unitId: string) {
  const unit = await prisma.zatcaUnit.findUniqueOrThrow({
    where: { id: unitId },
    include: { credentials: true }
  });

  if (!unit.credentials?.privateKey) {
    throw new Error('SDK state not found. Call generateCsr first to initialize state.');
  }

  const fullStateStr = decryptSecret(unit.credentials.privateKey);
  const fullState = JSON.parse(fullStateStr);

  const ZClient = await getZATCAClient();
  const client = new ZClient({
    env: unit.environment as 'sandbox' | 'simulation' | 'production',
    egsUnit: fullState.egsUnit,
    state: fullState.sdkState,
    solutionName: 'E-commerce System'
  });

  return { client, fullState, unit };
}

async function saveClientState(unitId: string, client: any, fullState: any) {
  fullState.sdkState = client.getState();
  const encrypted = encryptSecret(JSON.stringify(fullState));

  await prisma.zatcaCredential.update({
    where: { unitId },
    data: { privateKey: encrypted }
  });
}

async function logZatcaError(action: string, error: any) {
  await prisma.zatcaLog.create({
    data: {
      action,
      status: 'error',
      httpStatus: 400,
      responsePayload: JSON.parse(JSON.stringify(error, Object.getOwnPropertyNames(error))),
      errorMessage: error?.message || String(error),
    }
  });
}

// --- EXPORTED SERVICE FUNCTIONS ---

/**
 * 1. Initialize State (Replaces generateCsr logic)
 */
export async function generateCsr(unitId: string, overrides: any = {}) {
  const unit = await prisma.zatcaUnit.findUniqueOrThrow({ where: { id: unitId } });
  
  const vatNumber = overrides.vatNumber || '399999999900003';
  const egsUnit = {
    uuid: overrides.uuid || randomUUID(),
    branchName: overrides.branchName || 'Riyadh Branch',
    branchIndustry: overrides.industry || 'Supply activities',
    location: overrides.address || 'RRRD2929',
    commonName: overrides.commonName || `TST-886431145-${vatNumber}`,
    organizationName: overrides.organizationName || 'Maximum Speed Tech Supply LTD',
    countryCode: 'SA',
    vatNumber: vatNumber,
    invoiceType: overrides.invoiceType || '1100',
  };

  const ZClient = await getZATCAClient();
  const client = new ZClient({ 
    env: unit.environment as 'sandbox' | 'simulation' | 'production', 
    egsUnit, 
    solutionName: 'E-commerce System' 
  });
  
  const fullState = {
    sdkState: client.getState(),
    egsUnit
  };

  const encrypted = encryptSecret(JSON.stringify(fullState));

  await prisma.zatcaCredential.upsert({
    where: { unitId },
    update: { privateKey: encrypted, csr: 'MANAGED_BY_SDK' },
    create: { unitId, privateKey: encrypted, csr: 'MANAGED_BY_SDK' },
  });

  return { success: true, message: 'Initialized SDK state successfully' };
}

/**
 * 2. Request Compliance CSID (startOnboarding)
 */
export async function requestComplianceCsid(unitId: string, otp: string) {
  const { client, fullState } = await loadClient(unitId);
  
  const result = await client.startOnboarding(otp);
  if (!result.success) {
    await logZatcaError('startOnboarding', result.error);
    throw new Error(`ZATCA API Error: ${result.error?.message || JSON.stringify(result.error)}`);
  }

  await saveClientState(unitId, client, fullState);
  await prisma.zatcaUnit.update({ where: { id: unitId }, data: { status: 'COMPLIANCE' } });
  
  return { success: true, message: 'Compliance CSID acquired' };
}

/**
 * 3. Run Compliance Checks
 */
export async function runComplianceChecks(unitId: string) {
  const { client, fullState } = await loadClient(unitId);
  
  const kinds = ['STANDARD', 'SIMPLIFIED', 'CREDIT', 'DEBIT'] as const;
  const results = [];
  
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const invoice = buildInvoice(kind, i + 1);
    
    const res = await client.checkInvoiceCompliance(invoice);
    
    if (!res.success) {
      await logZatcaError(`compliance_check_${kind}`, res.error);
      results.push({ type: kind, status: 400, result: res.error, error: true });
    } else {
      const hasErrors = res.data.errorMessages && res.data.errorMessages.length > 0;
      results.push({ type: kind, status: 200, result: res.data, error: hasErrors });
    }
  }

  await saveClientState(unitId, client, fullState);
  
  return { success: true, results };
}

/**
 * 4. Request Production CSID (finishOnboarding)
 */
export async function requestProductionCsid(unitId: string) {
  const { client, fullState } = await loadClient(unitId);
  
  const result = await client.finishOnboarding();
  if (!result.success) {
    await logZatcaError('finishOnboarding', result.error);
    throw new Error(`ZATCA API Error: ${result.error?.message || JSON.stringify(result.error)}`);
  }

  await saveClientState(unitId, client, fullState);
  await prisma.zatcaUnit.update({ where: { id: unitId }, data: { status: 'CONNECTED' } });

  return { success: true, message: 'Production CSID acquired successfully' };
}

/**
 * 5. Renew Certificate
 */
export async function renewCertificate(unitId: string, otp: string) {
  const { client, fullState } = await loadClient(unitId);

  // تجديد الشهادة = إعادة عملية الـ startOnboarding بـ OTP جديد من بوابة فاتورة
  const result = await client.startOnboarding(otp);
  if (!result.success) {
    await logZatcaError('renewCertificate_startOnboarding', result.error);
    throw new Error(`ZATCA Renewal Error: ${result.error?.message || JSON.stringify(result.error)}`);
  }

  // بعد النجاح اطلب Production CSID جديد
  const finResult = await client.finishOnboarding();
  if (!finResult.success) {
    await logZatcaError('renewCertificate_finishOnboarding', finResult.error);
    throw new Error(`ZATCA Renewal Error (finish): ${finResult.error?.message || JSON.stringify(finResult.error)}`);
  }

  await saveClientState(unitId, client, fullState);
  await prisma.zatcaUnit.update({ where: { id: unitId }, data: { status: 'CONNECTED' } });

  return { success: true, message: 'Certificate renewed successfully' };
}