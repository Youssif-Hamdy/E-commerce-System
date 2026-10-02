import { create as xmlCreate } from 'xmlbuilder2';
import { env } from '../../../config/env';

export interface InvoiceXmlData {
  uuid: string;
  invoiceNumber: string;
  issueDate: Date;
  invoiceType: 'STANDARD' | 'SIMPLIFIED' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
  /**
   * STANDARD  = B2B (cleared), transaction code 0100000
   * SIMPLIFIED = B2C (reported), transaction code 0200000
   * Credit/debit notes must say which one they belong to.
   * Defaults: STANDARD -> STANDARD, everything else -> SIMPLIFIED.
   */
  profile?: 'STANDARD' | 'SIMPLIFIED';
  /** Invoice counter value (KSA-16). Required by ZATCA. */
  icv: number;
  /** Previous invoice hash (KSA-13), base64. Required by ZATCA. */
  pih: string;
  /** Reason for issuing a credit/debit note (KSA-10). Required for notes. */
  reason?: string;
  /** QR code (base64 TLV). Filled in by the signing step for simplified invoices. */
  qr?: string;
  seller: {
    name: string;
    vatNumber: string;
    crNumber?: string;
    buildingNumber?: string;
    street?: string;
    district?: string;
    city?: string;
    countryCode?: string;
    postalCode?: string;
  };
  buyer?: {
    name: string;
    vatNumber?: string;
    crNumber?: string;
    street?: string;
    buildingNumber?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    countryCode?: string;
  };
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discount: number;
    vatRate: number;
    vatAmount: number;
    total: number;
  }>;
  subtotal: number;
  vatAmount: number;
  total: number;
  currency?: string;
  originalInvoiceNumber?: string; // for credit/debit notes
}

const CUR = 'SAR';

/**
 * Generates ZATCA Phase 2 UBL 2.1 XML.
 * NOTE: element ORDER matters (XSD validation). Do not reorder blocks.
 *
 * Order: ProfileID, ID, UUID, IssueDate, IssueTime, InvoiceTypeCode,
 * DocumentCurrencyCode, TaxCurrencyCode, BillingReference, AdditionalDocumentReference (ICV, PIH, QR),
 * Signature, AccountingSupplierParty, AccountingCustomerParty, Delivery, PaymentMeans,
 * TaxTotal (x2), LegalMonetaryTotal, InvoiceLine...
 * (ext:UBLExtensions is inserted by the signer as the very first child.)
 */
export function generateInvoiceXml(data: InvoiceXmlData): string {
  const iso = data.issueDate.toISOString();
  const issueDateStr = iso.split('T')[0];
  const issueTimeStr = iso.split('T')[1].split('.')[0];

  const isNote = data.invoiceType === 'CREDIT_NOTE' || data.invoiceType === 'DEBIT_NOTE';
  const profile = data.profile ?? (data.invoiceType === 'STANDARD' ? 'STANDARD' : 'SIMPLIFIED');
  const isStandard = profile === 'STANDARD';

  // BT-3: 388 = invoice (BOTH standard and simplified), 381 = credit note, 383 = debit note
  const typeCode =
    data.invoiceType === 'CREDIT_NOTE' ? '381' : data.invoiceType === 'DEBIT_NOTE' ? '383' : '388';

  // KSA-2: NNPFSB (NN = 01 standard / 02 simplified)
  const transactionType = isStandard ? '0100000' : '0200000';

  const vatPercent = (data.items[0]?.vatRate ?? 15).toFixed(2);

  const root = xmlCreate({ version: '1.0', encoding: 'UTF-8' }).ele('Invoice', {
    xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
    'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
    'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
    'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
  });

  root.ele('cbc:ProfileID').txt('reporting:1.0');
  root.ele('cbc:ID').txt(data.invoiceNumber);
  root.ele('cbc:UUID').txt(data.uuid);
  root.ele('cbc:IssueDate').txt(issueDateStr);
  root.ele('cbc:IssueTime').txt(issueTimeStr);
  root.ele('cbc:InvoiceTypeCode', { name: transactionType }).txt(typeCode);
  root.ele('cbc:DocumentCurrencyCode').txt(data.currency || CUR);
  root.ele('cbc:TaxCurrencyCode').txt(CUR);

  // Reference to the original invoice (credit/debit notes)
  if (isNote && data.originalInvoiceNumber) {
    root
      .ele('cac:BillingReference')
      .ele('cac:InvoiceDocumentReference')
      .ele('cbc:ID')
      .txt(data.originalInvoiceNumber);
  }

  // ICV (KSA-16)
  root
    .ele('cac:AdditionalDocumentReference')
    .ele('cbc:ID').txt('ICV').up()
    .ele('cbc:UUID').txt(String(data.icv));

  // PIH (KSA-13)
  const pihRef = root.ele('cac:AdditionalDocumentReference');
  pihRef.ele('cbc:ID').txt('PIH');
  pihRef
    .ele('cac:Attachment')
    .ele('cbc:EmbeddedDocumentBinaryObject', { mimeCode: 'text/plain' })
    .txt(data.pih);

  // QR (KSA-14) - only when provided by the signing step
  if (data.qr) {
    const qrRef = root.ele('cac:AdditionalDocumentReference');
    qrRef.ele('cbc:ID').txt('QR');
    qrRef
      .ele('cac:Attachment')
      .ele('cbc:EmbeddedDocumentBinaryObject', { mimeCode: 'text/plain' })
      .txt(data.qr);
  }

  // Signature reference (the actual signature lives in ext:UBLExtensions)
  const sig = root.ele('cac:Signature');
  sig.ele('cbc:ID').txt('urn:oasis:names:specification:ubl:signature:Invoice');
  sig.ele('cbc:SignatureMethod').txt('urn:oasis:names:specification:ubl:dsig:enveloped:xades');

  // ---- Seller ----
  const s = data.seller;
  const supplierParty = root.ele('cac:AccountingSupplierParty').ele('cac:Party');
  supplierParty
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: 'CRN' })
    .txt(s.crNumber || env.zatca.crNumber);
  const sAddr = supplierParty.ele('cac:PostalAddress');
  sAddr.ele('cbc:StreetName').txt(s.street || env.zatca.street);
  sAddr.ele('cbc:BuildingNumber').txt(s.buildingNumber || env.zatca.buildingNumber);
  sAddr.ele('cbc:CitySubdivisionName').txt(s.district || env.zatca.district);
  sAddr.ele('cbc:CityName').txt(s.city || env.zatca.city);
  sAddr.ele('cbc:PostalZone').txt(s.postalCode || env.zatca.postalCode);
  sAddr.ele('cac:Country').ele('cbc:IdentificationCode').txt(s.countryCode || 'SA');
  const sTax = supplierParty.ele('cac:PartyTaxScheme');
  sTax.ele('cbc:CompanyID').txt(s.vatNumber || env.zatca.vatNumber);
  sTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');
  supplierParty
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName')
    .txt(s.name || env.zatca.sellerName);

  // ---- Buyer ---- (element is REQUIRED by the XSD, even if empty for simplified invoices)
  const customer = root.ele('cac:AccountingCustomerParty');
  const customerParty = customer.ele('cac:Party');
  if (data.buyer) {
    const b = data.buyer;
    if (b.crNumber) {
      customerParty.ele('cac:PartyIdentification').ele('cbc:ID', { schemeID: 'CRN' }).txt(b.crNumber);
    }
    const bAddr = customerParty.ele('cac:PostalAddress');
    if (b.street) bAddr.ele('cbc:StreetName').txt(b.street);
    if (b.buildingNumber) bAddr.ele('cbc:BuildingNumber').txt(b.buildingNumber);
    if (b.district) bAddr.ele('cbc:CitySubdivisionName').txt(b.district);
    if (b.city) bAddr.ele('cbc:CityName').txt(b.city);
    if (b.postalCode) bAddr.ele('cbc:PostalZone').txt(b.postalCode);
    bAddr.ele('cac:Country').ele('cbc:IdentificationCode').txt(b.countryCode || 'SA');
    const bTax = customerParty.ele('cac:PartyTaxScheme');
    if (b.vatNumber) bTax.ele('cbc:CompanyID').txt(b.vatNumber);
    bTax.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');
    customerParty.ele('cac:PartyLegalEntity').ele('cbc:RegistrationName').txt(b.name);
  }

  // Supply date (KSA-5) - required for standard (tax) invoices and their notes
  if (isStandard) {
    root.ele('cac:Delivery').ele('cbc:ActualDeliveryDate').txt(issueDateStr);
  }

  // Payment means (+ reason for credit/debit notes, KSA-10)
  const pm = root.ele('cac:PaymentMeans');
  pm.ele('cbc:PaymentMeansCode').txt('10'); // 10 = cash
  if (isNote) {
    pm.ele('cbc:InstructionNote').txt(data.reason || 'Correction');
  }

  // Tax total #1: amount only (in tax currency)
  root.ele('cac:TaxTotal').ele('cbc:TaxAmount', { currencyID: CUR }).txt(data.vatAmount.toFixed(2));

  // Tax total #2: with breakdown
  const taxTotal = root.ele('cac:TaxTotal');
  taxTotal.ele('cbc:TaxAmount', { currencyID: CUR }).txt(data.vatAmount.toFixed(2));
  const sub = taxTotal.ele('cac:TaxSubtotal');
  sub.ele('cbc:TaxableAmount', { currencyID: CUR }).txt(data.subtotal.toFixed(2));
  sub.ele('cbc:TaxAmount', { currencyID: CUR }).txt(data.vatAmount.toFixed(2));
  const cat = sub.ele('cac:TaxCategory');
  cat.ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5305' }).txt('S');
  cat.ele('cbc:Percent').txt(vatPercent);
  cat.ele('cac:TaxScheme').ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5153' }).txt('VAT');

  // Legal monetary total
  const lmt = root.ele('cac:LegalMonetaryTotal');
  lmt.ele('cbc:LineExtensionAmount', { currencyID: CUR }).txt(data.subtotal.toFixed(2));
  lmt.ele('cbc:TaxExclusiveAmount', { currencyID: CUR }).txt(data.subtotal.toFixed(2));
  lmt.ele('cbc:TaxInclusiveAmount', { currencyID: CUR }).txt(data.total.toFixed(2));
  lmt.ele('cbc:AllowanceTotalAmount', { currencyID: CUR }).txt('0.00');
  lmt.ele('cbc:PrepaidAmount', { currencyID: CUR }).txt('0.00');
  lmt.ele('cbc:PayableAmount', { currencyID: CUR }).txt(data.total.toFixed(2));

  // Invoice lines
  data.items.forEach((item, index) => {
    const line = root.ele('cac:InvoiceLine');
    line.ele('cbc:ID').txt(String(index + 1));
    line.ele('cbc:InvoicedQuantity', { unitCode: 'PCE' }).txt(item.quantity.toFixed(6));
    line
      .ele('cbc:LineExtensionAmount', { currencyID: CUR })
      .txt((item.quantity * item.unitPrice - item.discount).toFixed(2));

    // Line discount (only when there is one)
    if (item.discount > 0) {
      const ac = line.ele('cac:AllowanceCharge');
      ac.ele('cbc:ChargeIndicator').txt('false');
      ac.ele('cbc:AllowanceChargeReason').txt('discount');
      ac.ele('cbc:Amount', { currencyID: CUR }).txt(item.discount.toFixed(2));
    }

    const lt = line.ele('cac:TaxTotal');
    lt.ele('cbc:TaxAmount', { currencyID: CUR }).txt(item.vatAmount.toFixed(2));
    lt.ele('cbc:RoundingAmount', { currencyID: CUR }).txt(item.total.toFixed(2));

    const it = line.ele('cac:Item');
    it.ele('cbc:Name').txt(item.name);
    const ctc = it.ele('cac:ClassifiedTaxCategory');
    ctc.ele('cbc:ID').txt('S');
    ctc.ele('cbc:Percent').txt(item.vatRate.toFixed(2));
    ctc.ele('cac:TaxScheme').ele('cbc:ID').txt('VAT');

    line.ele('cac:Price').ele('cbc:PriceAmount', { currencyID: CUR }).txt(item.unitPrice.toFixed(2));
  });

  return root.end({ prettyPrint: true });
}