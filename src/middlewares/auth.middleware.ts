import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { errorResponse } from '../utils/response';

export interface JwtPayload {
  userId: string;
  email: string;
  roleId: string;
  roleName: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      permissions?: string[];
    }
  }
}

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      errorResponse(res, 'No token provided', 401);
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: {
        role: {
          include: { rolePermissions: { include: { permission: true } } },
        },
      },
    });
    if (!user || !user.isActive) {
      errorResponse(res, 'User not found or inactive', 401);
      return;
    }
    req.user = decoded;
    req.permissions = user.role.rolePermissions.map((rp) => rp.permission.name);
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      errorResponse(res, 'Token expired', 401);
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorResponse(res, 'Invalid token', 401);
    } else {
      errorResponse(res, 'Authentication failed', 401);
    }
  }
}
