import { Request, Response, NextFunction } from 'express';
import {
  startStockCountSchema, submitCountSchema,
  listStockCounts, getStockCount, startStockCount, submitCountItems, approveStockCount,
} from './stock-counts.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /stock-counts:
 *   get:
 *     tags: [StockCounts]
 *     summary: List stock counts
 *     responses: { 200: { description: Stock counts list } }
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const r = await listStockCounts(req.query as Record<string, string>);
    paginatedResponse(res, r.data, r.total, r.page, r.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /stock-counts/{id}:
 *   get:
 *     tags: [StockCounts]
 *     summary: Get Single Stock Count Details
 *     description: Retrieve details of a specific stock count session, including all items, system quantities, actual quantities, and discrepancies. Useful before approving and adjusting.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stock count session details with discrepancy items
 *       404:
 *         description: Stock count not found
 */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getStockCount(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /stock-counts:
 *   post:
 *     tags: [StockCounts]
 *     summary: Start new stock count
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               warehouseId: { type: string, format: uuid }
 *               notes: { type: string }
 *               productIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 description: Leave empty to count all products
 *     responses:
 *       201:
 *         description: Stock count started with system quantities
 */
export async function start(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = startStockCountSchema.parse(req.body);
    successResponse(res, await startStockCount(dto, req.user!.userId), 'Stock count started', 201);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /stock-counts/{id}/items:
 *   put:
 *     tags: [StockCounts]
 *     summary: Submit actual counted quantities
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     actualQuantity: { type: number, example: 97 }
 *                     notes: { type: string }
 *     responses:
 *       200:
 *         description: Items updated with differences calculated
 */
export async function submitItems(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = submitCountSchema.parse(req.body);
    successResponse(res, await submitCountItems(req.params.id, dto), 'Count submitted');
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /stock-counts/{id}/approve:
 *   post:
 *     tags: [StockCounts]
 *     summary: Approve stock count (applies inventory adjustments)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Approved and inventory adjusted
 */
export async function approve(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    successResponse(res, await approveStockCount(req.params.id), 'Stock count approved and inventory updated');
  } catch (e) { next(e); }
}
