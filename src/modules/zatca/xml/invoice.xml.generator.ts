import { create as xmlCreate } from 'xmlbuilder2';
import { env } from '../../../config/env';

export interface InvoiceXmlData {
  uuid: string;
  invoiceNumber: string;
  issueDate: Date;
  invoiceType: 'STANDARD' | 'SIMPLIFIED' | 'CREDIT_NOTE' | 'DEBIT_NOTE';
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
    city?: string;
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

/**
 * Generates ZATCA-compliant UBL 2.1 XML for Saudi e-invoicing
 * Based on ZATCA Phase 2 specifications
 */
export function generateInvoiceXml(data: InvoiceXmlData): string {
  const issueDateStr = data.issueDate.toISOString().split('T')[0];
  const issueTimeStr = data.issueDate.toISOString().split('T')[1].split('.')[0];

  // Invoice type codes
  // 388 = Standard (B2B clearance)
  // 385 = Simplified (B2C reporting)
  // 381 = Credit note
  // 383 = Debit note
  const typeCodeMap: Record<string, string> = {
    STANDARD: '388',
    SIMPLIFIED: '385',
    CREDIT_NOTE: '381',
    DEBIT_NOTE: '383',
  };
  const typeCode = typeCodeMap[data.invoiceType] || '385';

  // Transaction type code
  // 0100000 = Standard
  // 0200000 = Simplified
  const transactionType = data.invoiceType === 'STANDARD' ? '0100000' : '0200000';

  const xml = xmlCreate({ version: '1.0', encoding: 'UTF-8' })
    .ele('Invoice', {
      xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      'xmlns:cac': 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      'xmlns:cbc': 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      'xmlns:ext': 'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
    })
    .ele('cbc:ProfileID').txt('reporting:1.0').up()
    .ele('cbc:ID').txt(data.invoiceNumber).up()
    .ele('cbc:UUID').txt(data.uuid).up()
    .ele('cbc:IssueDate').txt(issueDateStr).up()
    .ele('cbc:IssueTime').txt(issueTimeStr).up()
    .ele('cbc:InvoiceTypeCode', { name: transactionType }).txt(typeCode).up()
    .ele('cbc:DocumentCurrencyCode').txt(data.currency || 'SAR').up()
    .ele('cbc:TaxCurrencyCode').txt('SAR').up();

  // Add original invoice reference for credit/debit notes
  if (data.originalInvoiceNumber && (data.invoiceType === 'CREDIT_NOTE' || data.invoiceType === 'DEBIT_NOTE')) {
    xml
      .ele('cac:BillingReference')
      .ele('cac:InvoiceDocumentReference')
      .ele('cbc:ID').txt(data.originalInvoiceNumber).up()
      .up()
      .up();
  }

  // Seller (AccountingSupplierParty)
  const seller = data.seller || {
    name: env.zatca.sellerName,
    vatNumber: env.zatca.vatNumber,
    crNumber: env.zatca.crNumber,
    buildingNumber: env.zatca.buildingNumber,
    street: env.zatca.street,
    district: env.zatca.district,
    city: env.zatca.city,
    countryCode: env.zatca.countryCode,
    postalCode: env.zatca.postalCode,
  };

  xml
    .ele('cac:AccountingSupplierParty')
    .ele('cac:Party')
    .ele('cac:PartyIdentification')
    .ele('cbc:ID', { schemeID: 'CRN' }).txt(seller.crNumber || env.zatca.crNumber).up()
    .up()
    .ele('cac:PostalAddress')
    .ele('cbc:StreetName').txt(seller.street || env.zatca.street).up()
    .ele('cbc:BuildingNumber').txt(seller.buildingNumber || env.zatca.buildingNumber).up()
    .ele('cbc:PlotIdentification').txt(seller.district || env.zatca.district).up()
    .ele('cbc:CityName').txt(seller.city || env.zatca.city).up()
    .ele('cbc:PostalZone').txt(seller.postalCode || env.zatca.postalCode).up()
    .ele('cac:Country')
    .ele('cbc:IdentificationCode').txt(seller.countryCode || 'SA').up()
    .up()
    .up()
    .ele('cac:PartyTaxScheme')
    .ele('cbc:CompanyID').txt(seller.vatNumber || env.zatca.vatNumber).up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID').txt('VAT').up()
    .up()
    .up()
    .ele('cac:PartyLegalEntity')
    .ele('cbc:RegistrationName').txt(seller.name || env.zatca.sellerName).up()
    .up()
    .up()
    .up();

  // Buyer (AccountingCustomerParty) - optional for simplified invoices
  if (data.buyer) {
    xml
      .ele('cac:AccountingCustomerParty')
      .ele('cac:Party')
      .ele('cac:PostalAddress')
      .ele('cbc:CityName').txt(data.buyer.city || '').up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode').txt(data.buyer.countryCode || 'SA').up()
      .up()
      .up()
      .ele('cac:PartyTaxScheme')
      .ele('cbc:CompanyID').txt(data.buyer.vatNumber || '').up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID').txt('VAT').up()
      .up()
      .up()
      .ele('cac:PartyLegalEntity')
      .ele('cbc:RegistrationName').txt(data.buyer.name).up()
      .up()
      .up()
      .up();
  }

  // Payment means
  xml
    .ele('cac:PaymentMeans')
    .ele('cbc:PaymentMeansCode').txt('10').up() // 10 = cash
    .up();

  // Tax total
  xml
    .ele('cac:TaxTotal')
    .ele('cbc:TaxAmount', { currencyID: 'SAR' }).txt(data.vatAmount.toFixed(2)).up()
    .ele('cac:TaxSubtotal')
    .ele('cbc:TaxableAmount', { currencyID: 'SAR' }).txt(data.subtotal.toFixed(2)).up()
    .ele('cbc:TaxAmount', { currencyID: 'SAR' }).txt(data.vatAmount.toFixed(2)).up()
    .ele('cac:TaxCategory')
    .ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5305' }).txt('S').up()
    .ele('cbc:Percent').txt('15').up()
    .ele('cac:TaxScheme')
    .ele('cbc:ID', { schemeAgencyID: '6', schemeID: 'UN/ECE 5153' }).txt('VAT').up()
    .up()
    .up()
    .up()
    .up();

  // Legal monetary total
  xml
    .ele('cac:LegalMonetaryTotal')
    .ele('cbc:LineExtensionAmount', { currencyID: 'SAR' }).txt(data.subtotal.toFixed(2)).up()
    .ele('cbc:TaxExclusiveAmount', { currencyID: 'SAR' }).txt(data.subtotal.toFixed(2)).up()
    .ele('cbc:TaxInclusiveAmount', { currencyID: 'SAR' }).txt(data.total.toFixed(2)).up()
    .ele('cbc:AllowanceTotalAmount', { currencyID: 'SAR' }).txt('0.00').up()
    .ele('cbc:PayableAmount', { currencyID: 'SAR' }).txt(data.total.toFixed(2)).up()
    .up();

  // Invoice lines
  data.items.forEach((item, index) => {
    xml
      .ele('cac:InvoiceLine')
      .ele('cbc:ID').txt(String(index + 1)).up()
      .ele('cbc:InvoicedQuantity', { unitCode: 'PCE' }).txt(item.quantity.toString()).up()
      .ele('cbc:LineExtensionAmount', { currencyID: 'SAR' })
      .txt((item.quantity * item.unitPrice - item.discount).toFixed(2))
      .up()
      .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: 'SAR' }).txt(item.vatAmount.toFixed(2)).up()
      .ele('cbc:RoundingAmount', { currencyID: 'SAR' }).txt(item.total.toFixed(2)).up()
      .up()
      .ele('cac:Item')
      .ele('cbc:Name').txt(item.name).up()
      .ele('cac:ClassifiedTaxCategory')
      .ele('cbc:ID').txt('S').up()
      .ele('cbc:Percent').txt(item.vatRate.toFixed(2)).up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID').txt('VAT').up()
      .up()
      .up()
      .up()
      .ele('cac:Price')
      .ele('cbc:PriceAmount', { currencyID: 'SAR' }).txt(item.unitPrice.toFixed(2)).up()
      .ele('cbc:AllowanceCharge')
      .ele('cbc:ChargeIndicator').txt('false').up()
      .ele('cbc:AllowanceChargeReason').txt('discount').up()
      .ele('cbc:Amount', { currencyID: 'SAR' }).txt(item.discount.toFixed(2)).up()
      .up()
      .up()
      .up();
  });

  return xml.end({ prettyPrint: true });
}
