import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import { successResponse, paginatedResponse } from '../../utils/response';
import { zatcaOnboarding } from './api/zatca.client';
import { parsePagination } from '../../utils/pagination';

/**
 * @swagger
 * /zatca/status:
 *   get:
 *     tags: [ZATCA]
 *     summary: Get ZATCA integration status and configuration
 *     responses:
 *       200:
 *         description: ZATCA config and environment info
 */
export async function getStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await prisma.invoice.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    successResponse(res, {
      environment: env.zatca.env,
      sellerName: env.zatca.sellerName,
      vatNumber: env.zatca.vatNumber,
      isMockMode: env.zatca.env === 'mock',
      mockNote: env.zatca.env === 'mock'
        ? 'Running in MOCK mode. All ZATCA responses are simulated. Set ZATCA_ENV=sandbox or production for real integration.'
        : undefined,
      invoicesSummary: summary.reduce((acc, s) => {
        acc[s.status] = s._count.status;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /zatca/onboarding:
 *   post:
 *     tags: [ZATCA]
 *     summary: Onboard with ZATCA (get CSID)
 *     description: |
 *       **MOCK MODE**: Use any OTP. Returns simulated CSID.
 *       **PRODUCTION**: Provide the real OTP from ZATCA portal.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [otp]
 *             properties:
 *               otp:
 *                 type: string
 *                 example: "123456"
 *                 description: OTP from ZATCA Fatoora portal (use 123456 in mock mode)
 *     responses:
 *       200:
 *         description: CSID received from ZATCA
 */
export async function onboarding(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { otp } = req.body;
    if (!otp) {
      res.status(400).json({ success: false, message: 'OTP is required' });
      return;
    }
    const result = await zatcaOnboarding(otp);
    successResponse(res, result, `Onboarding successful (${env.zatca.env} mode)`);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /zatca/test:
 *   post:
 *     tags: [ZATCA]
 *     summary: Test ZATCA connection with a sample invoice
 *     description: Sends a test invoice to ZATCA mock/sandbox to verify connectivity
 *     responses:
 *       200:
 *         description: Test result from ZATCA
 */
export async function testConnection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    // Find first completed invoice and re-test
    const invoice = await prisma.invoice.findFirst({
      where: { signedXml: { not: null } },
      orderBy: { createdAt: 'desc' },
    });
    if (!invoice) {
      successResponse(res, {
        mode: env.zatca.env,
        message: 'No invoices available to test. Create a sale first.',
        mockReady: true,
      });
      return;
    }
    const { zatcaReporting } = await import('./api/zatca.client');
    const result = await zatcaReporting(invoice.signedXml!, invoice.uuid, invoice.xmlHash || '');
    successResponse(res, { mode: env.zatca.env, result }, 'Test successful');
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /zatca/logs:
 *   get:
 *     tags: [ZATCA]
 *     summary: Get ZATCA submission logs
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [success, error, warning] }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: ZATCA logs
 */
export async function getLogs(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const status = req.query.status as string | undefined;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    const [data, total] = await Promise.all([
      prisma.zatcaLog.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      prisma.zatcaLog.count({ where }),
    ]);
    paginatedResponse(res, data, total, page, limit);
  } catch (e) { next(e); }
}
