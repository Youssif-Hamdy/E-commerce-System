import { Request, Response, NextFunction } from 'express';
import { loginSchema, registerSchema, refreshTokenSchema } from './auth.schema';
import {
  loginService,
  registerService,
  refreshTokenService,
  logoutService,
  getMeService,
} from './auth.service';
import { successResponse, errorResponse } from '../../utils/response';

/**
 * @swagger
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login user
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 example: admin@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean }
 *                 data:
 *                   type: object
 *                   properties:
 *                     accessToken: { type: string, description: "Valid for 30 days" }
 *                     refreshToken: { type: string, description: "Valid for 7 days" }
 *                     expiresIn: { type: string, example: "30d" }
 *                     tokenType: { type: string, example: "Bearer" }
 *                     user: { type: object }
 *       401:
 *         description: Invalid credentials
 */
export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = loginSchema.parse(req.body);
    const result = await loginService(dto);
    successResponse(res, result, 'Login successful');
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /auth/roles:
 *   get:
 *     tags: [Auth]
 *     summary: "⚡ [PUBLIC] Get available roles — use before Register"
 *     description: |
 *       ## للفرونت اند — خطوة مهمة قبل التسجيل
 *
 *       هذا الـ endpoint **لا يحتاج توكن** (Public).
 *
 *       ### الخطوات الصحيحة للتسجيل:
 *
 *       **1️⃣ الخطوة الأولى** — اجلب قائمة الأدوار المتاحة:
 *       ```
 *       GET /api/v1/auth/roles
 *       ```
 *
 *       **2️⃣ الخطوة الثانية** — اعرض الأدوار في dropdown واجعل المستخدم يختار
 *
 *       **3️⃣ الخطوة الثالثة** — ابعت `id` الدور المختار كـ `roleId` في طلب التسجيل:
 *       ```
 *       POST /api/v1/auth/register
 *       { ..., "roleId": "<id من الاستجابة>" }
 *       ```
 *     security: []
 *     responses:
 *       200:
 *         description: قائمة الأدوار المتاحة
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                         description: "استخدم هذا الـ id كـ roleId في التسجيل"
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
 *                       name:
 *                         type: string
 *                         description: "اسم الدور — اعرضه للمستخدم في الـ dropdown"
 *                         example: "Cashier"
 *                       description:
 *                         type: string
 *                         example: "أمين الصندوق"
 *                       isActive:
 *                         type: boolean
 *                         example: true
 *             example:
 *               success: true
 *               data:
 *                 - id: "550e8400-e29b-41d4-a716-446655440000"
 *                   name: "Admin"
 *                   description: "صلاحيات كاملة"
 *                   isActive: true
 *                 - id: "550e8400-e29b-41d4-a716-446655440001"
 *                   name: "Manager"
 *                   description: "مدير المبيعات"
 *                   isActive: true
 *                 - id: "550e8400-e29b-41d4-a716-446655440002"
 *                   name: "Cashier"
 *                   description: "أمين الصندوق"
 *                   isActive: true
 *                 - id: "550e8400-e29b-41d4-a716-446655440003"
 *                   name: "Warehouse"
 *                   description: "أمين المخزن"
 *                   isActive: true
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register new user
 *     description: |
 *       ## ⚠️ مهم — كيفية الحصول على `roleId`
 *
 *       قبل استدعاء هذا الـ endpoint، يجب أولاً جلب قائمة الأدوار من:
 *       ```
 *       GET /api/v1/auth/roles   ← لا يحتاج توكن
 *       ```
 *       ثم استخدم الـ `id` من الاستجابة كقيمة لحقل `roleId`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, roleId]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Ahmed Ali"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "ahmed@example.com"
 *               password:
 *                 type: string
 *                 minLength: 6
 *                 example: "password123"
 *               phone:
 *                 type: string
 *                 example: "+966501234567"
 *               roleId:
 *                 type: string
 *                 format: uuid
 *                 description: "الـ id للدور — يُجلب أولاً من GET /auth/roles"
 *                 example: "550e8400-e29b-41d4-a716-446655440002"
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 message: { type: string, example: "User registered successfully" }
 *                 data:
 *                   type: object
 *                   properties:
 *                     id: { type: string, format: uuid }
 *                     name: { type: string, example: "Ahmed Ali" }
 *                     email: { type: string, example: "ahmed@example.com" }
 *                     role: { type: string, example: "Cashier" }
 *       400:
 *         description: Validation error — بيانات غير صحيحة
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Validation error"
 *               errors: [{ field: "roleId", message: "Invalid role ID" }]
 *       404:
 *         description: Role not found — الـ roleId غير موجود، استخدم GET /auth/roles للحصول على الـ id الصحيح
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Role not found"
 *       409:
 *         description: Email already registered — الإيميل مسجل مسبقاً
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Email already registered"
 */
export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = registerSchema.parse(req.body);
    const result = await registerService(dto);
    successResponse(res, result, 'User registered successfully', 201);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Refresh access token
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: New access token generated
 *       401:
 *         description: Invalid or expired refresh token
 */
export async function refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: token } = refreshTokenSchema.parse(req.body);
    const result = await refreshTokenService(token);
    successResponse(res, result, 'Token refreshed successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Logout user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: Logged out successfully
 */
export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { refreshToken: token } = req.body;
    if (token) await logoutService(token);
    successResponse(res, null, 'Logged out successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     responses:
 *       200:
 *         description: Current user data with permissions
 */
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await getMeService(req.user!.userId);
    successResponse(res, result, 'User profile retrieved');
  } catch (error) {
    next(error);
  }
}

import { forgotPasswordSchema, resetPasswordSchema, googleLoginSchema } from './auth.schema';
import { forgotPasswordService, resetPasswordService, googleLoginService } from './auth.service';

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     tags: [Auth]
 *     summary: Request password reset link
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, example: "admin@example.com" }
 *     responses:
 *       200:
 *         description: Reset link sent
 */
export async function forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = forgotPasswordSchema.parse(req.body);
    const result = await forgotPasswordService(dto);
    successResponse(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /auth/reset-password:
 *   post:
 *     tags: [Auth]
 *     summary: Reset password
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, newPassword]
 *             properties:
 *               token: { type: string }
 *               newPassword: { type: string, example: "newpassword123" }
 *     responses:
 *       200:
 *         description: Password reset successfully
 */
export async function resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = resetPasswordSchema.parse(req.body);
    const result = await resetPasswordService(dto);
    successResponse(res, result, result.message);
  } catch (error) {
    next(error);
  }
}

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Login with Google
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token]
 *             properties:
 *               token: { type: string, description: "Google OAuth2 ID token" }
 *     responses:
 *       200:
 *         description: Login successful
 */
export async function googleLogin(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const dto = googleLoginSchema.parse(req.body);
    const result = await googleLoginService(dto);
    successResponse(res, result, 'Logged in with Google successfully');
  } catch (error) {
    next(error);
  }
}
