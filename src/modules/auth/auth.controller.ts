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
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register new user
 *     description: |
 *       تسجيل مستخدم جديد في النظام.
 *
 *       > **ملاحظة:** يتم تعيين دور **Cashier** تلقائياً لكل مستخدم جديد.
 *       > الأدمن فقط هو من يستطيع تغيير الدور لاحقاً عبر `PUT /users/{id}`.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
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
 *     responses:
 *       201:
 *         description: تم التسجيل بنجاح
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "User registered successfully"
 *               data:
 *                 id: "550e8400-e29b-41d4-a716-446655440000"
 *                 name: "Ahmed Ali"
 *                 email: "ahmed@example.com"
 *                 role: "Cashier"
 *       409:
 *         description: الإيميل مسجل مسبقاً
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Email already registered"
 *       400:
 *         description: بيانات غير صحيحة
 *         content:
 *           application/json:
 *             example:
 *               success: false
 *               message: "Validation error"
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
