import { describe, expect, it, vi } from "vitest";
import { writeAuditLog } from "./audit.js";

describe("audit helpers", () => {
  it("writes an audit log through the passed transaction", async () => {
    const auditLog = {
      id: "audit-log-id",
      actorId: "actor-id",
      action: "transaction.posted",
      entityType: "TRANSACTION",
      entityId: "transaction-id",
      data: { amount: 5000 },
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const tx = {
      auditLog: {
        create: vi.fn().mockResolvedValue(auditLog),
      },
    };

    const result = await writeAuditLog(tx, {
      actorId: "actor-id",
      action: "transaction.posted",
      entityType: "TRANSACTION",
      entityId: "transaction-id",
      data: { amount: 5000 },
    });

    expect(result).toBe(auditLog);
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: "actor-id",
        action: "transaction.posted",
        entityType: "TRANSACTION",
        entityId: "transaction-id",
        data: { amount: 5000 },
      },
    });
  });
});
