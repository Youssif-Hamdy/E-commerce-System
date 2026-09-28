import { Request, Response, NextFunction } from 'express';
import { unitSchema, listUnits, createUnit, updateUnit } from './units.service';
import { successResponse } from '../../utils/response';

/**
 * @swagger
 * /units:
 *   get:
 *     tags: [Units]
 *     summary: List all units
 *     responses:
 *       200:
 *         description: List of units
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listUnits();
    successResponse(res, result);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /units:
 *   post:
 *     tags: [Units]
 *     summary: Create unit
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, symbol]
 *             properties:
 *               name: { type: string, example: "Piece" }
 *               symbol: { type: string, example: "PCS" }
 *     responses:
 *       201:
 *         description: Unit created
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = unitSchema.parse(req.body);
    const result = await createUnit(dto);
    successResponse(res, result, 'Unit created', 201);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = unitSchema.partial().parse(req.body);
    const result = await updateUnit(req.params.id, dto);
    successResponse(res, result, 'Unit updated');
  } catch (e) { next(e); }
}
