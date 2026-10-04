import { Request, Response, NextFunction } from 'express';
import { warehouseSchema, listWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from './warehouses.service';
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

/**
 * @swagger
 * /warehouses/{id}:
 *   put:
 *     tags: [Warehouses]
 *     summary: Update warehouse name and location
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "Branch A Warehouse" }
 *               location: { type: string, example: "Riyadh - Zone 5" }
 *               isDefault: { type: boolean }
 *     responses:
 *       200:
 *         description: Warehouse updated
 *       404:
 *         description: Warehouse not found
 *       409:
 *         description: Warehouse name already exists
 */
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = warehouseSchema.partial().parse(req.body);
    successResponse(res, await updateWarehouse(req.params.id, dto), 'Warehouse updated');
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /warehouses/{id}:
 *   delete:
 *     tags: [Warehouses]
 *     summary: Deactivate (soft-delete) a warehouse
 *     description: Marks the warehouse as inactive. Fails if the warehouse still has stock or is the default warehouse.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Warehouse deactivated
 *       400:
 *         description: Cannot delete — has stock or is default warehouse
 *       404:
 *         description: Warehouse not found
 */
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteWarehouse(req.params.id);
    successResponse(res, null, 'Warehouse deactivated');
  } catch (e) { next(e); }
}
