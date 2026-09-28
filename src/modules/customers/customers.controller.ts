import { Request, Response, NextFunction } from 'express';
import { customerSchema, listCustomers, getCustomer, createCustomer, updateCustomer } from './customers.service';
import { successResponse, paginatedResponse } from '../../utils/response';

/**
 * @swagger
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: List customers
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name, phone, email, VAT number
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Paginated customers
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await listCustomers(req.query as Record<string, string>);
    paginatedResponse(res, result.data, result.total, result.page, result.limit);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get customer by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Customer details
 */
export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getCustomer(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "محمد علي" }
 *               vatNumber: { type: string, example: "300000000000003" }
 *               phone: { type: string, example: "+966501234567" }
 *               email: { type: string }
 *               city: { type: string, example: "Riyadh" }
 *     responses:
 *       201:
 *         description: Customer created
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = customerSchema.parse(req.body);
    successResponse(res, await createCustomer(dto), 'Customer created', 201);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = customerSchema.partial().parse(req.body);
    successResponse(res, await updateCustomer(req.params.id, dto), 'Customer updated');
  } catch (e) { next(e); }
}
