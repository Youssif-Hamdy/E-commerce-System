import { env } from '../../../config/env';
import { logger } from '../../../config/logger';
import {
  mockOnboarding,
  mockComplianceCheck,
  mockReporting,
  mockClearance,
} from '../mock/zatca.mock';

/**
 * ZATCA API Client
 * ================
 * Routes requests to Mock or Real ZATCA API based on ZATCA_ENV
 *
 * ZATCA_ENV=mock        → Uses mock simulator
 * ZATCA_ENV=sandbox     → Uses ZATCA sandbox API
 * ZATCA_ENV=production  → Uses ZATCA production API
 */

const BASE_HEADERS = {
  'Content-Type': 'application/json',
  'Accept-Version': 'V2',
};

async function realApiRequest(endpoint: string, payload: Record<string, string>, csid: string) {
  const baseUrl =
    env.zatca.env === 'production' ? env.zatca.apiUrl : env.zatca.sandboxUrl;
  const url = `${baseUrl}${endpoint}`;

  // Base64 encode CSID for Authorization
  const authToken = Buffer.from(`${csid}:`).toString('base64');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      ...BASE_HEADERS,
      Authorization: `Basic ${authToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ZATCA API error ${response.status}: ${error}`);
  }

  return response.json();
}

export async function zatcaOnboarding(otp: string) {
  logger.info(`[ZATCA] Onboarding - mode: ${env.zatca.env}`);
  if (env.zatca.env === 'mock') {
    return mockOnboarding(otp);
  }
  // Real onboarding - compliance CSID
  return realApiRequest('/compliance', { otp }, '');
}

export async function zatcaComplianceCheck(xml: string, uuid: string) {
  logger.info(`[ZATCA] Compliance check - mode: ${env.zatca.env}`);
  if (env.zatca.env === 'mock') {
    return mockComplianceCheck(xml, uuid);
  }
  const xmlBase64 = Buffer.from(xml).toString('base64');
  return realApiRequest(
    '/compliance/invoices',
    { invoice: xmlBase64, invoiceHash: '', uuid },
    env.zatca.csid
  );
}

export async function zatcaReporting(xml: string, uuid: string, invoiceHash: string) {
  logger.info(`[ZATCA] Reporting - mode: ${env.zatca.env}`, { uuid });
  if (env.zatca.env === 'mock') {
    return mockReporting(xml, uuid);
  }
  const xmlBase64 = Buffer.from(xml).toString('base64');
  return realApiRequest(
    '/invoices/reporting/single',
    { invoice: xmlBase64, invoiceHash, uuid },
    env.zatca.csid
  );
}

export async function zatcaClearance(xml: string, uuid: string, invoiceHash: string) {
  logger.info(`[ZATCA] Clearance - mode: ${env.zatca.env}`, { uuid });
  if (env.zatca.env === 'mock') {
    return mockClearance(xml, uuid);
  }
  const xmlBase64 = Buffer.from(xml).toString('base64');
  return realApiRequest(
    '/invoices/clearance/single',
    { invoice: xmlBase64, invoiceHash, uuid },
    env.zatca.csid
  );
}
