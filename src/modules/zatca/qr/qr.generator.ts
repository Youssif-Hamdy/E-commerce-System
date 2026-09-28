import QRCode from 'qrcode';

/**
 * ZATCA TLV QR Code Generator
 * ============================
 * Generates QR code per ZATCA Phase 2 specs using TLV (Tag-Length-Value) encoding.
 *
 * TLV Tags:
 * 01 - Seller name
 * 02 - VAT registration number
 * 03 - Invoice timestamp (ISO format)
 * 04 - Invoice total (with VAT)
 * 05 - VAT amount
 */

function tlvEncode(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, 'utf8');
  const tagBuffer = Buffer.alloc(1);
  tagBuffer.writeUInt8(tag);
  const lengthBuffer = Buffer.alloc(1);
  lengthBuffer.writeUInt8(valueBuffer.length);
  return Buffer.concat([tagBuffer, lengthBuffer, valueBuffer]);
}

export function generateTlvBase64(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;    // ISO 8601
  totalWithVat: number;
  vatAmount: number;
}): string {
  const tlv = Buffer.concat([
    tlvEncode(1, params.sellerName),
    tlvEncode(2, params.vatNumber),
    tlvEncode(3, params.timestamp),
    tlvEncode(4, params.totalWithVat.toFixed(2)),
    tlvEncode(5, params.vatAmount.toFixed(2)),
  ]);
  return tlv.toString('base64');
}

export async function generateQrCodeDataUrl(tlvBase64: string): Promise<string> {
  return QRCode.toDataURL(tlvBase64, {
    errorCorrectionLevel: 'M',
    type: 'image/png',
    width: 200,
    margin: 1,
  });
}

export async function generateZatcaQr(params: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: number;
  vatAmount: number;
}): Promise<{ tlv: string; qrDataUrl: string }> {
  const tlv = generateTlvBase64(params);
  const qrDataUrl = await generateQrCodeDataUrl(tlv);
  return { tlv, qrDataUrl };
}
