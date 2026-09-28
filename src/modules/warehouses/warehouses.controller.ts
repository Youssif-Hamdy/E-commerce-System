import { Request, Response, NextFunction } from 'express';
import { warehouseSchema, listWarehouses, createWarehouse } from './warehouses.service';
import { successResponse } from '../../utils/response';

/**
 * @swagger
 * /warehouses:
 *   get:
 *     tags: [Warehouses]
 *     summary: List warehouses
 *     responses:
 *       200:
 *         description: List of warehouses
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await listWarehouses()); } catch (e) { next(e); }
}

/**
 * @swagger
 * /warehouses:
 *   post:
 *     tags: [Warehouses]
 *     summary: Create warehouse
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Main Warehouse" }
 *               location: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       201:
 *         description: Warehouse created
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = warehouseSchema.parse(req.body);
    successResponse(res, await createWarehouse(dto), 'Warehouse created', 201);
  } catch (e) { next(e); }
}
