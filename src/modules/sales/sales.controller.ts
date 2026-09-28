import { Request, Response, NextFunction } from 'express';
import { createSaleSchema } from './sales.schema';
import { listSales, getSale, createSale, cancelSale } from './sales.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /sales:
 *   get:
 *     tags: [Sales]
 *     summary: List sales
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: customerId
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [PENDING, COMPLETED, CANCELLED, REFUNDED] }
 *     responses:
 *       200:
 *         description: Paginated sales list
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listSales(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /sales/{id}:
 *   get:
 *     tags: [Sales]
 *     summary: Get sale by ID (includes invoice QR code)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sale details with invoice and QR code
 */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getSale(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /sales:
 *   post:
 *     tags: [Sales]
 *     summary: Create sale (checks stock, calculates VAT, creates invoice, submits to ZATCA)
 *     description: |
 *       Full sale flow:
 *       1. Validates stock availability for all items
 *       2. Calculates VAT (15% per product)
 *       3. Creates sale, payment, and inventory transactions atomically
 *       4. Generates ZATCA tax invoice (UBL XML + QR code)
 *       5. Submits to ZATCA (mock/sandbox/production based on env)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [items]
 *             properties:
 *               customerId:
 *                 type: string
 *                 format: uuid
 *                 description: Leave empty for walk-in customer
 *               warehouseId:
 *                 type: string
 *                 format: uuid
 *                 description: Leave empty to use default warehouse
 *               paymentMethod:
 *                 type: string
 *                 enum: [CASH, CARD, BANK_TRANSFER, OTHER]
 *                 default: CASH
 *               discountAmount:
 *                 type: number
 *                 example: 0
 *               notes:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: number, example: 2 }
 *                     unitPrice: { type: number, description: "Override product price (optional)" }
 *                     discount: { type: number, example: 0 }
 *     responses:
 *       201:
 *         description: Sale created with invoice and ZATCA submission
 *       400:
 *         description: Insufficient stock or validation error
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = createSaleSchema.parse(req.body);
    const result = await createSale(dto, req.user!.userId);
    successResponse(res, result, 'Sale created successfully', 201);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /sales/{id}/cancel:
 *   patch:
 *     tags: [Sales]
 *     summary: Cancel a pending sale
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Sale cancelled
 */
export async function cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await cancelSale(req.params.id);
    successResponse(res, result, 'Sale cancelled');
  } catch (e) { next(e); }
}
