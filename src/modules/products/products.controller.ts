import { Request, Response, NextFunction } from 'express';
import { createProductSchema, updateProductSchema } from './products.schema';
import { listProducts, getProduct, createProduct, updateProduct, deleteProduct, getProductBySku } from './products.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /products:
 *   get:
 *     tags: [Products]
 *     summary: List all products
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, SKU, or barcode
 *       - in: query
 *         name: categoryId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated products list
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listProducts(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /products/{id}:
 *   get:
 *     tags: [Products]
 *     summary: Get product by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product details
 *       404:
 *         description: Product not found
 */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getProduct(req.params.id);
    successResponse(res, result);
  } catch (e) { next(e); }
}

export async function getBySku(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getProductBySku(req.params.sku);
    successResponse(res, result);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Create product
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sku, name, categoryId, unitId, salePrice]
 *             properties:
 *               sku: { type: string, example: "PRD-001" }
 *               name: { type: string, example: "iPhone 15" }
 *               nameAr: { type: string, example: "ايفون 15" }
 *               categoryId: { type: string, format: uuid }
 *               unitId: { type: string, format: uuid }
 *               purchasePrice: { type: number, example: 3500 }
 *               salePrice: { type: number, example: 4500 }
 *               vatRate: { type: number, example: 15, description: "VAT percentage" }
 *               isVatExempt: { type: boolean, example: false }
 *               barcode: { type: string }
 *     responses:
 *       201:
 *         description: Product created
 *       409:
 *         description: SKU already exists
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = createProductSchema.parse(req.body);
    const result = await createProduct(dto);
    successResponse(res, result, 'Product created', 201);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /products/{id}:
 *   put:
 *     tags: [Products]
 *     summary: Update product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { type: object }
 *     responses:
 *       200:
 *         description: Product updated
 */
export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = updateProductSchema.parse(req.body);
    const result = await updateProduct(req.params.id, dto);
    successResponse(res, result, 'Product updated');
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /products/{id}:
 *   delete:
 *     tags: [Products]
 *     summary: Deactivate product
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Product deactivated
 */
export async function remove(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await deleteProduct(req.params.id);
    successResponse(res, null, 'Product deactivated');
  } catch (e) { next(e); }
}
