import type { EntityType, Prisma } from "@hibi/db";

type AuditLogDelegate = {
  create(args: {
    data: Prisma.AuditLogCreateInput;
  }): Promise<Prisma.AuditLogGetPayload<object>>;
};

export type AuditLogTransaction = {
  auditLog: AuditLogDelegate;
};

export type WriteAuditLogInput = {
  actorId: string;
  action: string;
  entityType: EntityType;
  entityId: string;
  data: Prisma.InputJsonValue;
};

export async function writeAuditLog(
  tx: AuditLogTransaction,
  input: WriteAuditLogInput,
) {
  return await tx.auditLog.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      data: input.data,
    },
  });
}
