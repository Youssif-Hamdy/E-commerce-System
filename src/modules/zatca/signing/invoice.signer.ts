import crypto from 'crypto';

/**
 * ZATCA Invoice Signing (Mock Implementation)
 * =============================================
 * In MOCK mode: generates a fake signature.
 * In PRODUCTION mode: uses real ECDSA (secp256k1) with the actual certificate.
 *
 * KNOWN LIMITATION (why ZATCA still reports "invalid-invoice-hash" in the sandbox):
 * ZATCA calculates the invoice hash from the CANONICALIZED (C14N 1.1) XML after removing
 *   - ext:UBLExtensions
 *   - cac:Signature
 *   - the AdditionalDocumentReference whose ID is "QR"
 * then SHA-256 -> base64. hashInvoiceXml below does NOT do that yet, so the hash will not match.
 * Fix this with a proper C14N implementation or ZATCA's SDK / a vetted library.
 *
 * For production:
 * 1. Get CSR from ZATCA onboarding
 * 2. Receive CSID (certificate)
 * 3. Sign XML using ECDSA with the private key, build the XAdES block and the QR (TLV, base64)
 */

export function hashInvoiceXml(xml: string): string {
  // TEMPORARY: simple normalization only. Not ZATCA-compliant canonicalization (see note above).
  const normalized = xml
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .join('\n');
  return crypto.createHash('sha256').update(normalized).digest('base64');
}

export function signXmlMock(xml: string, invoiceHash: string): string {
  // Mock signature - for development only
  const mockSignature = crypto
    .createHash('sha256')
    .update(xml + invoiceHash + Date.now())
    .digest('hex');

  const extensions = `  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <!-- MOCK SIGNATURE: ${mockSignature} -->
        <!-- InvoiceHash: ${invoiceHash} -->
        <!-- Generated: ${new Date().toISOString()} -->
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`;

  // ext:UBLExtensions MUST be the first child of <Invoice>, right after the opening tag.
  return xml.replace(/<Invoice\b[^>]*>/, (open) => `${open}\n${extensions}`);
}

export function signXmlProduction(
  xml: string,
  privateKey: string,
  certificate: string
): string {
  // TODO: Implement real ECDSA signing when ZATCA credentials are available
  // (private key from onboarding + certificate, XAdES block, QR code).
  throw new Error(
    'Production signing not yet implemented. Set ZATCA_ENV=mock for development.'
  );
}