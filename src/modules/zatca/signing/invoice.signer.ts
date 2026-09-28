import crypto from 'crypto';

/**
 * ZATCA Invoice Signing (Mock Implementation)
 * =============================================
 * In MOCK mode: generates a fake hash and signature
 * In PRODUCTION mode: uses real ECDSA P-256 with actual certificate
 *
 * For production:
 * 1. Get CSR from ZATCA onboarding
 * 2. Receive CSID (certificate)
 * 3. Sign XML using ECDSA with the private key
 */

export function hashInvoiceXml(xml: string): string {
  // Remove whitespace-only lines and normalize for hashing
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

  return xml.replace(
    '</Invoice>',
    `  <ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <!-- MOCK SIGNATURE: ${mockSignature} -->
        <!-- InvoiceHash: ${invoiceHash} -->
        <!-- Generated: ${new Date().toISOString()} -->
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>
</Invoice>`
  );
}

export function signXmlProduction(
  xml: string,
  privateKey: string,
  certificate: string
): string {
  // TODO: Implement real ECDSA P-256 signing when ZATCA credentials are available
  // This would use the private key from ZATCA onboarding
  throw new Error(
    'Production signing not yet implemented. Set ZATCA_ENV=mock for development.'
  );
}
