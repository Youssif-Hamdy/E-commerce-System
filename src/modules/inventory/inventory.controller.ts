import { Request, Response, NextFunction } from 'express';
import {
  listInventory,
  getInventoryByProduct,
  listMovements,
  createAdjustment,
  getLowStockProducts,
  adjustmentSchema,
  transferSchema,
  transferStock,
} from './inventory.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: Get current stock levels
 *     parameters:
 *       - in: query
 *         name: warehouseId
 *         schema: { type: string }
 *       - in: query
 *         name: lowStock
 *         schema: { type: boolean }
 *         description: Filter items below minimum quantity
 *     responses:
 *       200:
 *         description: Inventory levels
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listInventory(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

export async function getByProduct(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getInventoryByProduct(req.params.productId)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /inventory/movements:
 *   get:
 *     tags: [Inventory]
 *     summary: Get stock movements/transactions
 *     parameters:
 *       - in: query
 *         name: productId
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PURCHASE, SALE, RETURN_IN, RETURN_OUT, STOCK_ADJUSTMENT, TRANSFER_IN, TRANSFER_OUT, OPENING_STOCK]
 *     responses:
 *       200:
 *         description: Stock movements
 */
export async function getMovements(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listMovements(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /inventory/adjustment:
 *   post:
 *     tags: [Inventory]
 *     summary: Create stock adjustment
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, warehouseId, quantity]
 *             properties:
 *               productId: { type: string, format: uuid }
 *               warehouseId: { type: string, format: uuid }
 *               quantity: { type: number, description: "Positive to add, negative to subtract", example: -3 }
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Adjustment created
 *       400:
 *         description: Would result in negative stock
 */
export async function adjustment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = adjustmentSchema.parse(req.body);
    const result = await createAdjustment(dto, req.user!.userId);
    successResponse(res, result, 'Stock adjustment created');
  } catch (e) { next(e); }
}

export async function lowStock(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getLowStockProducts()); } catch (e) { next(e); }
}

/**
 * @swagger
 * /inventory/transfer:
 *   post:
 *     tags: [Inventory]
 *     summary: Transfer stock between warehouses
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fromWarehouseId, toWarehouseId, productId, quantity]
 *             properties:
 *               fromWarehouseId: { type: string, format: uuid }
 *               toWarehouseId: { type: string, format: uuid }
 *               productId: { type: string, format: uuid }
 *               quantity: { type: number, example: 25 }
 *               notes: { type: string, example: "تحويل مخزون بين الفروع" }
 *     responses:
 *       200:
 *         description: Stock transfer successful
 *       400:
 *         description: Insufficient stock or same warehouses
 *       404:
 *         description: Warehouse or Product not found
 */
export async function transfer(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = transferSchema.parse(req.body);
    const result = await transferStock(dto, req.user!.userId);
    successResponse(res, result, 'Stock transferred successfully');
  } catch (e) { next(e); }
}
