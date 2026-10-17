import prisma from '../database/prisma';
import { AuthUser } from '../types';

interface AuditParams {
  user?: AuthUser | null;
  action: string;
  module: string;
  recordId?: string;
  oldData?: unknown;
  newData?: unknown;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.user?.id || null,
        action: params.action,
        module: params.module,
        recordId: params.recordId || null,
        oldData: params.oldData ? (params.oldData as object) : undefined,
        newData: params.newData ? (params.newData as object) : undefined,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
      },
    });
  } catch (e) {
    // Audit logging should never break the main flow
    console.error('[AUDIT] Failed to write audit log', e);
  }
}
