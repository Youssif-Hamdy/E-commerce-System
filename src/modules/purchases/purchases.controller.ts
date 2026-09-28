import { Request, Response, NextFunction } from 'express';
import { createPurchaseSchema } from './purchases.schema';
import { listPurchases, getPurchase, createPurchase } from './purchases.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /purchases:
 *   get:
 *     tags: [Purchases]
 *     summary: List purchase orders
 *     responses: { 200: { description: Paginated purchases } }
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listPurchases(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /purchases/{id}:
 *   get:
 *     tags: [Purchases]
 *     summary: Get purchase by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses: { 200: { description: Purchase details } }
 */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getPurchase(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /purchases:
 *   post:
 *     tags: [Purchases]
 *     summary: Create purchase order (automatically updates inventory)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplierId, warehouseId, items]
 *             properties:
 *               supplierId: { type: string, format: uuid }
 *               warehouseId: { type: string, format: uuid }
 *               notes: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity, unitCost]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: number, example: 10 }
 *                     unitCost: { type: number, example: 350 }
 *     responses:
 *       201:
 *         description: Purchase created and inventory updated
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = createPurchaseSchema.parse(req.body);
    const result = await createPurchase(dto, req.user!.userId);
    successResponse(res, result, 'Purchase created and inventory updated', 201);
  } catch (e) { next(e); }
}
