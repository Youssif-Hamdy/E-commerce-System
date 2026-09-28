import { prisma } from '../config/database';
import { logger } from '../config/logger';

export async function logAudit(params: {
  userId?: string;
  action: string;
  module: string;
  entityId?: string;
  oldValues?: unknown;
  newValues?: unknown;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: params.action,
        module: params.module,
        entityId: params.entityId,
        oldValues: params.oldValues
          ? JSON.parse(JSON.stringify(params.oldValues))
          : undefined,
        newValues: params.newValues
          ? JSON.parse(JSON.stringify(params.newValues))
          : undefined,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
      },
    });
  } catch (error) {
    logger.error('Failed to write audit log:', error);
  }
}
