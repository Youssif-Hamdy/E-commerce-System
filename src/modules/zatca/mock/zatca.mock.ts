import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../../config/logger';

/**
 * ZATCA Mock Simulator
 * =====================
 * Mimics exactly the ZATCA Phase 2 API responses.
 * Switch ZATCA_ENV=mock to use this, ZATCA_ENV=production to use real API.
 *
 * Simulates:
 * - Onboarding / CSID generation
 * - Compliance check
 * - Reporting (Simplified invoices - B2C)
 * - Clearance (Standard invoices - B2B)
 * - Credit/Debit note submission
 * - Error scenarios (10% random failure rate for testing)
 */

export interface ZatcaMockReportingResponse {
  reportingStatus: 'REPORTED' | 'NOT_REPORTED';
  clearanceStatus: null;
  timestamp: string;
  invoiceHash: string;
  uuid: string;
  warnings: string[];
  validationResults: {
    status: 'PASS' | 'WARNING' | 'ERROR';
    infoMessages: Array<{ type: string; code: string; message: string }>;
    warningMessages: Array<{ type: string; code: string; message: string; category: string; status: string }>;
    errorMessages: Array<{ type: string; code: string; message: string; category: string; status: string }>;
  };
}

export interface ZatcaMockClearanceResponse {
  reportingStatus: null;
  clearanceStatus: 'CLEARED' | 'NOT_CLEARED';
  timestamp: string;
  invoiceHash: string;
  uuid: string;
  clearedInvoice?: string; // base64 of cleared XML
  warnings: string[];
  validationResults: {
    status: 'PASS' | 'WARNING' | 'ERROR';
    infoMessages: Array<{ type: string; code: string; message: string }>;
    warningMessages: Array<{ type: string; code: string; message: string; category: string; status: string }>;
    errorMessages: Array<{ type: string; code: string; message: string; category: string; status: string }>;
  };
}

export interface ZatcaMockOnboardingResponse {
  requestID: string;
  disposalMethod: string;
  csid: string;
  warnings: string[];
  errors: string[];
}

function generateFakeHash(xml: string): string {
  return crypto.createHash('sha256').update(xml + Date.now()).digest('hex');
}

function generateFakeCsid(): string {
  const random = crypto.randomBytes(32).toString('base64url');
  return `MOCK-CSID-${random}`;
}

function shouldSimulateError(): boolean {
  // 10% chance of error for testing error handling
  return Math.random() < 0.1;
}

// ── Onboarding Mock ───────────────────────────────────────────────────────────
export async function mockOnboarding(otp: string): Promise<ZatcaMockOnboardingResponse> {
  logger.info('[ZATCA MOCK] Onboarding request received', { otp });

  await new Promise((r) => setTimeout(r, 500)); // Simulate network delay

  if (otp !== '123456' && !otp.startsWith('MOCK')) {
    logger.warn('[ZATCA MOCK] Onboarding: Invalid OTP (use 123456 or MOCK-* prefix for mock)');
  }

  return {
    requestID: uuidv4(),
    disposalMethod: 'PUSH',
    csid: generateFakeCsid(),
    warnings: ['[MOCK] This is a simulated CSID. Replace with real credentials from ZATCA portal.'],
    errors: [],
  };
}

// ── Compliance Check Mock ─────────────────────────────────────────────────────
export async function mockComplianceCheck(xml: string, invoiceUuid: string): Promise<ZatcaMockReportingResponse> {
  logger.info('[ZATCA MOCK] Compliance check', { invoiceUuid });
  await new Promise((r) => setTimeout(r, 300));

  return {
    reportingStatus: 'REPORTED',
    clearanceStatus: null,
    timestamp: new Date().toISOString(),
    invoiceHash: generateFakeHash(xml),
    uuid: invoiceUuid,
    warnings: [],
    validationResults: {
      status: 'PASS',
      infoMessages: [{ type: 'INFO', code: 'XSD_VALID', message: '[MOCK] XML schema validation passed' }],
      warningMessages: [],
      errorMessages: [],
    },
  };
}

// ── Reporting Mock (B2C / Simplified Invoices) ────────────────────────────────
export async function mockReporting(xml: string, invoiceUuid: string): Promise<ZatcaMockReportingResponse> {
  logger.info('[ZATCA MOCK] Reporting invoice', { invoiceUuid });
  await new Promise((r) => setTimeout(r, 400));

  if (shouldSimulateError()) {
    logger.warn('[ZATCA MOCK] Simulating reporting error');
    return {
      reportingStatus: 'NOT_REPORTED',
      clearanceStatus: null,
      timestamp: new Date().toISOString(),
      invoiceHash: generateFakeHash(xml),
      uuid: invoiceUuid,
      warnings: [],
      validationResults: {
        status: 'ERROR',
        infoMessages: [],
        warningMessages: [],
        errorMessages: [
          {
            type: 'ERROR',
            code: 'BR-KSA-F-06',
            message: '[MOCK SIMULATED ERROR] Invoice issue date is in future',
            category: 'XSD error',
            status: 'ERROR',
          },
        ],
      },
    };
  }

  return {
    reportingStatus: 'REPORTED',
    clearanceStatus: null,
    timestamp: new Date().toISOString(),
    invoiceHash: generateFakeHash(xml),
    uuid: invoiceUuid,
    warnings: [],
    validationResults: {
      status: 'PASS',
      infoMessages: [
        { type: 'INFO', code: 'REPORTED', message: '[MOCK] Invoice successfully reported to ZATCA' },
      ],
      warningMessages: [],
      errorMessages: [],
    },
  };
}

// ── Clearance Mock (B2B / Standard Invoices) ──────────────────────────────────
export async function mockClearance(xml: string, invoiceUuid: string): Promise<ZatcaMockClearanceResponse> {
  logger.info('[ZATCA MOCK] Clearance invoice', { invoiceUuid });
  await new Promise((r) => setTimeout(r, 600));

  if (shouldSimulateError()) {
    logger.warn('[ZATCA MOCK] Simulating clearance error');
    return {
      reportingStatus: null,
      clearanceStatus: 'NOT_CLEARED',
      timestamp: new Date().toISOString(),
      invoiceHash: generateFakeHash(xml),
      uuid: invoiceUuid,
      warnings: [],
      validationResults: {
        status: 'ERROR',
        infoMessages: [],
        warningMessages: [],
        errorMessages: [
          {
            type: 'ERROR',
            code: 'BR-KSA-EN-01',
            message: '[MOCK SIMULATED ERROR] Seller VAT number is invalid',
            category: 'Business rule',
            status: 'ERROR',
          },
        ],
      },
    };
  }

  // Simulate a cleared XML (add ZATCA clearance stamp)
  const clearedXml = xml.replace(
    '</Invoice>',
    `  <!-- ZATCA MOCK CLEARANCE STAMP: ${new Date().toISOString()} UUID: ${invoiceUuid} -->\n</Invoice>`
  );

  return {
    reportingStatus: null,
    clearanceStatus: 'CLEARED',
    timestamp: new Date().toISOString(),
    invoiceHash: generateFakeHash(xml),
    uuid: invoiceUuid,
    clearedInvoice: Buffer.from(clearedXml).toString('base64'),
    warnings: [],
    validationResults: {
      status: 'PASS',
      infoMessages: [
        { type: 'INFO', code: 'CLEARED', message: '[MOCK] Invoice successfully cleared by ZATCA' },
      ],
      warningMessages: [],
      errorMessages: [],
    },
  };
}
