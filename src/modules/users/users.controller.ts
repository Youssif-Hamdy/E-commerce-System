import { Request, Response, NextFunction } from 'express';
import { createUserSchema, updateUserSchema, listUsers, getUser, createUser, updateUser, listRoles, createRole, updateRolePermissions, listPermissions } from './users.service';
import { successResponse, paginatedResponse } from '../../utils/response';
import { z } from 'zod';

// ── Users ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users:
 *   get:
 *     tags: [Users]
 *     summary: List all users
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Users list
 */
export async function getAll(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const r = await listUsers(req.query as Record<string, string>);
    paginatedResponse(res, r.data, r.total, r.page, r.limit);
  } catch (e) { next(e); }
}

export async function getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await getUser(req.params.id)); } catch (e) { next(e); }
}

/**
 * @swagger
 * /users:
 *   post:
 *     tags: [Users]
 *     summary: Create user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, roleId]
 *             properties:
 *               name: { type: string }
 *               email: { type: string }
 *               password: { type: string }
 *               phone: { type: string }
 *               roleId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: User created
 */
export async function create(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = createUserSchema.parse(req.body);
    successResponse(res, await createUser(dto), 'User created', 201);
  } catch (e) { next(e); }
}

export async function update(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = updateUserSchema.parse(req.body);
    successResponse(res, await updateUser(req.params.id, dto), 'User updated');
  } catch (e) { next(e); }
}

// ── Roles ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /roles:
 *   get:
 *     tags: [Roles]
 *     summary: List all roles with permissions
 *     responses:
 *       200:
 *         description: Roles list
 */
export async function getAllRoles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await listRoles()); } catch (e) { next(e); }
}

/**
 * @swagger
 * /roles:
 *   post:
 *     tags: [Roles]
 *     summary: Create role
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name: { type: string, example: "Cashier" }
 *               description: { type: string }
 *               permissionIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201:
 *         description: Role created
 */
export async function createRoleHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = z.object({ name: z.string(), description: z.string().optional(), permissionIds: z.array(z.string()).optional() }).parse(req.body);
    successResponse(res, await createRole(dto), 'Role created', 201);
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /roles/{id}/permissions:
 *   put:
 *     tags: [Roles]
 *     summary: Update role permissions
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
 *               permissionIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Permissions updated
 */
export async function updatePermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { permissionIds } = z.object({ permissionIds: z.array(z.string()) }).parse(req.body);
    successResponse(res, await updateRolePermissions(req.params.id, permissionIds), 'Permissions updated');
  } catch (e) { next(e); }
}

/**
 * @swagger
 * /permissions:
 *   get:
 *     tags: [Roles]
 *     summary: List all available permissions
 *     responses:
 *       200:
 *         description: Permissions list
 */
export async function getAllPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try { successResponse(res, await listPermissions()); } catch (e) { next(e); }
}
