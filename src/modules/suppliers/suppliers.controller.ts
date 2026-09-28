import { Request, Response, NextFunction } from 'express';
import { supplierSchema, listSuppliers, getSupplier, createSupplier, updateSupplier } from './suppliers.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /suppliers:
 *   get:
 *     tags: [Suppliers]
 *     summary: List suppliers
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated suppliers
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listSuppliers(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getSupplier(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Create supplier
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "شركة التوريد" }
 *               vatNumber: { type: string }
 *               phone: { type: string }
 *               email: { type: string }
 *               city: { type: string }
 *     responses:
 *       201:
 *         description: Supplier created
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = supplierSchema.parse(req.body);
    successResponse(res, await createSupplier(dto), 'Supplier created', 201);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = supplierSchema.partial().parse(req.body);
    successResponse(res, await updateSupplier(req.params.id, dto), 'Supplier updated');
  } catch (e) { next(e); }
}
