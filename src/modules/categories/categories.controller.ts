import { Request, Response, NextFunction } from 'express';
import { categorySchema, listCategories, createCategory, updateCategory, deleteCategory } from './categories.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /categories:
 *   get:
 *     tags: [Categories]
 *     summary: List all categories
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: List of categories
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listCategories(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create category
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Category created
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = categorySchema.parse(req.body);
    const result = await createCategory(dto);
    successResponse(res, result, 'Category created', 201);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = categorySchema.partial().parse(req.body);
    const result = await updateCategory(req.params.id, dto);
    successResponse(res, result, 'Category updated');
  } catch (e) { next(e); }
}

export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteCategory(req.params.id);
    successResponse(res, null, 'Category deleted');
  } catch (e) { next(e); }
}
