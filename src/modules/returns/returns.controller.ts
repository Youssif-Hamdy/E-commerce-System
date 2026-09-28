import { Request, Response, NextFunction } from 'express';
import { returnSchema, listReturns, getReturn, createReturn } from './returns.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /returns:
 *   get:
 *     tags: [Returns]
 *     summary: List all returns
 *     responses:
 *       200:
 *         description: Paginated returns list
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listReturns(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getReturn(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /returns:
 *   post:
 *     tags: [Returns]
 *     summary: Create return (restores inventory, creates credit note)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [saleId, items]
 *             properties:
 *               saleId: { type: string, format: uuid }
 *               reason: { type: string }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: number }
 *     responses:
 *       201:
 *         description: Return created, inventory restored, credit note generated
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = returnSchema.parse(req.body);
    const result = await createReturn(dto);
    successResponse(res, result, 'Return created and inventory restored', 201);
  } catch (e) { next(e); }
}
