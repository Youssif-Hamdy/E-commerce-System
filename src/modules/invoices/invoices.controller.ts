import { Request, Response, NextFunction } from 'express';
import { listInvoices, getInvoice, submitInvoiceToZatca, getInvoiceStatus } from './invoices.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /invoices:
 *   get:
 *     tags: [Invoices]
 *     summary: List all tax invoices
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, READY, SUBMITTED, REPORTED, CLEARED, COMPLETED, FAILED]
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated invoices list
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listInvoices(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     tags: [Invoices]
 *     summary: Get invoice by ID (includes XML, QR code, ZATCA logs)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Invoice details with QR code and ZATCA status
 */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getInvoice(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /invoices/{id}/submit:
 *   post:
 *     tags: [Invoices]
 *     summary: Manually submit invoice to ZATCA (retry failed invoices)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Submission result
 */
export async function submit(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await submitInvoiceToZatca(req.params.id);
    successResponse(res, result, 'Invoice submitted to ZATCA');
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /invoices/{id}/status:
 *   get:
 *     tags: [Invoices]
 *     summary: Get ZATCA submission status for invoice
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: ZATCA status
 */
export async function status(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getInvoiceStatus(req.params.id)); } catch (e) { next(e); }
}
