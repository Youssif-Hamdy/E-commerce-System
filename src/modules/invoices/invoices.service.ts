import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { generateInvoiceXml } from '../zatca/xml/invoice.xml.generator';
import { generateZatcaQr } from '../zatca/qr/qr.generator';
import { hashInvoiceXml, signXmlMock } from '../zatca/signing/invoice.signer';
import { zatcaReporting, zatcaClearance } from '../zatca/api/zatca.client';
import { parsePagination } from '../../utils/pagination';
import { decryptSecret } from '../zatca/utils/crypto';

// Dynamic import for ESM-only zatca-sdk
const dynamicImport = new Function('specifier', 'return import(specifier)');
let ZATCAClientMod: any = null;
async function getZATCAClient() {
  if (!ZATCAClientMod) ZATCAClientMod = await dynamicImport('zatca-sdk');
  return ZATCAClientMod.ZATCAClient;
}

/** INITIAL_PIH — الهاش الابتدائي المعتمد من ZATCA لأول فاتورة */
const INITIAL_PIH = 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==';

const invoiceInclude = {
  sale: {
    include: {
      customer: { select: { id: true, name: true, vatNumber: true } },
      saleItems: { include: { product: { select: { id: true, name: true, sku: true } } } },
    },
  },
  invoiceItems: true,
  zatcaLogs: { orderBy: { createdAt: 'desc' as const }, take: 5 },
};

export async function listInvoices(query: Record<string, string>) {
  const { page, limit, skip } = parsePagination(query);
  const status = query.status;
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  const [data, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { issueDate: 'desc' },
      include: {
        sale: { include: { customer: { select: { id: true, name: true } } } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getInvoice(id: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id }, include: invoiceInclude });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
  return invoice;
}

/**
 * Create ZATCA invoice for a completed sale
 * - Generates UBL 2.1 XML
 * - Generates TLV QR code
 * - Signs XML
 * - Submits to ZATCA (mock/sandbox/production)
 */
export async function createInvoiceForSale(saleId: string) {
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: true,
      saleItems: { include: { product: true } },
    },
  });
  if (!sale) throw Object.assign(new Error('Sale not found'), { statusCode: 404 });

  // Check if invoice already exists
  const existing = await prisma.invoice.findUnique({ where: { saleId } });
  if (existing) return existing;

  // Determine invoice type (simplified = B2C, standard = B2B with VAT number)
  const hasVatBuyer = !!(sale.customer?.vatNumber);
  const invoiceType = hasVatBuyer ? 'STANDARD' : 'SIMPLIFIED';

  // Generate invoice number
  const count = await prisma.invoice.count();
  const invoiceNumber = `EINV-${String(count + 1).padStart(6, '0')}`;
  const uuid = require('crypto').randomUUID();

  // ── PIH chain: جيب الهاش الحقيقي للفاتورة السابقة ──────────────────────────
  // 1. لو فيه ZatcaUnit CONNECTED — استخدم lastHash المسجَّل عليه
  // 2. لو لا — خذ xmlHash آخر فاتورة في الـ DB
  // 3. لو مفيش فواتير خالص — استخدم INITIAL_PIH
  const connectedUnit = await prisma.zatcaUnit.findFirst({
    where: { status: 'CONNECTED' },
    orderBy: { updatedAt: 'desc' },
    include: { credentials: true },
  });

  let pih: string;
  if (connectedUnit?.lastHash) {
    pih = connectedUnit.lastHash;
  } else {
    const lastInvoice = await prisma.invoice.findFirst({
      where: { xmlHash: { not: null } },
      orderBy: { createdAt: 'desc' },
      select: { xmlHash: true },
    });
    pih = lastInvoice?.xmlHash ?? INITIAL_PIH;
  }

  // Build XML data
  const xmlData = {
    uuid,
    invoiceNumber,
    issueDate: new Date(),
    invoiceType: invoiceType as 'STANDARD' | 'SIMPLIFIED',
    seller: {
      name: env.zatca.sellerName,
      vatNumber: env.zatca.vatNumber,
      crNumber: env.zatca.crNumber,
      buildingNumber: env.zatca.buildingNumber,
      street: env.zatca.street,
      district: env.zatca.district,
      city: env.zatca.city,
      countryCode: env.zatca.countryCode,
      postalCode: env.zatca.postalCode,
    },
    buyer: sale.customer
      ? {
          name: sale.customer.name,
          vatNumber: sale.customer.vatNumber || undefined,
          city: sale.customer.city || undefined,
          countryCode: sale.customer.country,
        }
      : undefined,
    items: sale.saleItems.map((item) => ({
      name: item.product.name,
      quantity: Number(item.quantity),
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discount),
      vatRate: Number(item.vatRate),
      vatAmount: Number(item.vatAmount),
      total: Number(item.total),
    })),
    subtotal: Number(sale.subtotal),
    vatAmount: Number(sale.vatAmount),
    total: Number(sale.total),
    icv: count + 1,
    pih,
  };

  // Generate XML
  const xml = generateInvoiceXml(xmlData);

  // Generate QR code
  const { tlv: qrTlv, qrDataUrl } = await generateZatcaQr({
    sellerName: env.zatca.sellerName,
    vatNumber: env.zatca.vatNumber,
    timestamp: new Date().toISOString(),
    totalWithVat: Number(sale.total),
    vatAmount: Number(sale.vatAmount),
  });

  // ── Hash + Sign ─────────────────────────────────────────────────────────────
  // لو فيه ZatcaUnit CONNECTED → استخدم SDK للـ signing الحقيقي
  // لو مفيش → استخدم mock signing للـ development
  const invoiceHash = hashInvoiceXml(xml);
  let signedXml: string;

  if (connectedUnit?.credentials?.privateKey) {
    try {
      const fullStateStr = decryptSecret(connectedUnit.credentials.privateKey);
      const fullState = JSON.parse(fullStateStr);
      const ZClient = await getZATCAClient();
      const sdkClient = new ZClient({
        env: connectedUnit.environment as 'sandbox' | 'simulation' | 'production',
        egsUnit: fullState.egsUnit,
        state: fullState.sdkState,
        solutionName: 'E-commerce System',
      });

      // بناء invoice object بصيغة zatca-sdk
      const sdkInvoice = {
        id: invoiceNumber,
        uuid,
        issueDate: xmlData.issueDate.toISOString().slice(0, 10),
        issueTime: xmlData.issueDate.toISOString().slice(11, 19),
        invoiceTypeCode: invoiceType === 'STANDARD' ? '388' : '388',
        invoiceSubType: invoiceType === 'STANDARD' ? '0100000' : '0200000',
        documentCurrency: 'SAR',
        taxCurrency: 'SAR',
        invoiceCounterValue: count + 1,
        previousInvoiceHash: pih,
        seller: {
          registrationName: env.zatca.sellerName,
          vatNumber: env.zatca.vatNumber,
          identification: { schemeId: 'CRN', value: env.zatca.crNumber },
          address: {
            street: env.zatca.street,
            buildingNumber: env.zatca.buildingNumber,
            citySubdivision: env.zatca.district,
            city: env.zatca.city,
            postalCode: env.zatca.postalCode,
            country: env.zatca.countryCode,
          },
        },
        buyer: sale.customer && hasVatBuyer ? {
          registrationName: sale.customer.name,
          vatNumber: sale.customer.vatNumber || undefined,
          address: {
            city: sale.customer.city || env.zatca.city,
            country: sale.customer.country || 'SA',
          },
        } : undefined,
        paymentMeansCode: '10',
        lineExtensionAmount: Number(sale.subtotal),
        taxExclusiveAmount: Number(sale.subtotal),
        taxInclusiveAmount: Number(sale.total),
        payableAmount: Number(sale.total),
        taxTotal: Number(sale.vatAmount),
        taxSubtotals: [{ taxableAmount: Number(sale.subtotal), taxAmount: Number(sale.vatAmount), taxCategory: 'S', taxPercent: 15 }],
        lines: sale.saleItems.map((item, i) => ({
          id: String(i + 1),
          name: item.product.name,
          quantity: Number(item.quantity),
          unitCode: 'PCE',
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.quantity) * Number(item.unitPrice) - Number(item.discount),
          vatCategory: 'S',
          vatPercent: Number(item.vatRate),
          vatAmount: Number(item.vatAmount),
        })),
      };

      const subResult = await sdkClient.submitInvoice(sdkInvoice as any);

      // حفَّظ الـ state الجديد بعد الـ submission
      fullState.sdkState = sdkClient.getState();
      const { encryptSecret } = await import('../zatca/utils/crypto');
      const encrypted = encryptSecret(JSON.stringify(fullState));
      await prisma.zatcaCredential.update({
        where: { unitId: connectedUnit.id },
        data: { privateKey: encrypted },
      });

      if (subResult.success && subResult.data?.signedInvoice?.invoiceHash) {
        signedXml = subResult.data.signedInvoice.invoiceXml ?? xml;
        // حدِّث lastHash + lastIcv على الـ Unit
        await prisma.zatcaUnit.update({
          where: { id: connectedUnit.id },
          data: {
            lastHash: subResult.data.signedInvoice.invoiceHash,
            lastIcv: count + 1,
          },
        });
        logger.info(`[ZATCA SDK] Invoice ${invoiceNumber} signed via SDK - mode: ${connectedUnit.environment}`);
      } else {
        logger.warn('[ZATCA SDK] SDK signing returned no invoiceHash — falling back to mock signing');
        signedXml = signXmlMock(xml, invoiceHash);
      }
    } catch (sdkErr: any) {
      logger.error('[ZATCA SDK] SDK signing failed — falling back to mock signing', { error: sdkErr?.message });
      signedXml = signXmlMock(xml, invoiceHash);
    }
  } else {
    // mock mode — no connected unit
    signedXml = signXmlMock(xml, invoiceHash);
    logger.info(`[ZATCA MOCK] Invoice ${invoiceNumber} signed in mock mode`);
  }



  // Create invoice record (READY status)
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber,
      uuid,
      saleId,
      type: invoiceType,
      status: 'READY',
      issueDate: new Date(),
      subtotal: Number(sale.subtotal),
      vatAmount: Number(sale.vatAmount),
      total: Number(sale.total),
      xmlContent: xml,
      xmlHash: invoiceHash,
      signedXml,
      qrCode: qrDataUrl,
      invoiceItems: {
        create: sale.saleItems.map((item) => ({
          productId: item.productId,
          name: item.product.name,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          discount: Number(item.discount),
          vatRate: Number(item.vatRate),
          vatAmount: Number(item.vatAmount),
          total: Number(item.total),
        })),
      },
    },
  });

  // Auto-submit to ZATCA
  await submitInvoiceToZatca(invoice.id);

  return invoice;
}

export async function submitInvoiceToZatca(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
  if (!invoice.signedXml) throw Object.assign(new Error('Invoice not signed'), { statusCode: 400 });

  // لو الفاتورة اتبعتت بالفعل عن طريق SDK في createInvoiceForSale — ماتبعتهاش تاني
  if (invoice.status === 'REPORTED' || invoice.status === 'CLEARED') {
    logger.info(`[ZATCA] Invoice ${invoice.invoiceNumber} already submitted via SDK — skipping re-submission`);
    return { status: invoice.status, response: invoice.zatcaResponse };
  }

  // Update to SUBMITTED
  await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'SUBMITTED', submittedAt: new Date() } });

  try {
    let response;
    if (invoice.type === 'STANDARD') {
      response = await zatcaClearance(invoice.signedXml, invoice.uuid, invoice.xmlHash || '');
    } else {
      response = await zatcaReporting(invoice.signedXml, invoice.uuid, invoice.xmlHash || '');
    }

    // Parse response
    const isSuccess =
      (response as { reportingStatus?: string }).reportingStatus === 'REPORTED' ||
      (response as { clearanceStatus?: string }).clearanceStatus === 'CLEARED';
    const status = isSuccess
      ? invoice.type === 'STANDARD'
        ? 'CLEARED'
        : 'REPORTED'
      : 'FAILED';

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status,
        zatcaStatus: invoice.type === 'STANDARD'
          ? (response as { clearanceStatus?: string }).clearanceStatus || 'UNKNOWN'
          : (response as { reportingStatus?: string }).reportingStatus || 'UNKNOWN',
        zatcaResponse: JSON.parse(JSON.stringify(response)),
        clearedAt: isSuccess ? new Date() : undefined,
        errorMessage: !isSuccess ? JSON.stringify((response as { validationResults?: unknown }).validationResults) : undefined,
      },
    });

    // Log ZATCA interaction
    await prisma.zatcaLog.create({
      data: {
        invoiceId,
        action: invoice.type === 'STANDARD' ? 'clearance' : 'reporting',
        requestPayload: { uuid: invoice.uuid, type: invoice.type } as object,
        responsePayload: response as object,
        status: isSuccess ? 'success' : 'error',
        httpStatus: 200,
        errorMessage: !isSuccess ? 'ZATCA rejected invoice' : undefined,
      },
    });

    logger.info(`[ZATCA] Invoice ${invoice.invoiceNumber} → ${status}`, { invoiceId, mode: env.zatca.env });
    return { status, response };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'FAILED',
        errorMessage: errorMsg,
        zatcaRetryCount: { increment: 1 },
      },
    });
    await prisma.zatcaLog.create({
      data: {
        invoiceId,
        action: 'submission',
        requestPayload: { uuid: invoice.uuid },
        status: 'error',
        errorMessage: errorMsg,
      },
    });
    logger.error(`[ZATCA] Invoice ${invoice.invoiceNumber} FAILED`, { error: errorMsg });
    throw error;
  }
}



export async function getInvoiceStatus(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, invoiceNumber: true, status: true, zatcaStatus: true, zatcaResponse: true, clearedAt: true, errorMessage: true, zatcaRetryCount: true },
  });
  if (!invoice) throw Object.assign(new Error('Invoice not found'), { statusCode: 404 });
  return invoice;
}
