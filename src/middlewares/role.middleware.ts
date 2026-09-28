import { Request, Response, NextFunction } from 'express';
import { errorResponse } from '../utils/response';

export function requirePermission(...permissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.permissions) {
      errorResponse(res, 'No permissions found', 403);
      return;
    }
    const hasPermission = permissions.some((p) => req.permissions!.includes(p));
    if (!hasPermission) {
      errorResponse(res, `Access denied. Required: ${permissions.join(' or ')}`, 403);
      return;
    }
    next();
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      errorResponse(res, 'Unauthorized', 401);
      return;
    }
    if (!roles.includes(req.user.roleName)) {
      errorResponse(res, `Access denied. Required role: ${roles.join(' or ')}`, 403);
      return;
    }
    next();
  };
}
