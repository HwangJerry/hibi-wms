import { describe, expect, it, vi } from "vitest";
import {
  UNLABELED_REFERENCE_RELATION,
  createReference,
  listReferences,
} from "./references.js";

describe("reference helpers", () => {
  it("creates a polymorphic reference", async () => {
    const reference = {
      id: "reference-id",
      fromType: "TASK",
      fromId: "task-id",
      toType: "PAGE",
      toId: "page-id",
      relation: "spec",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const client = {
      reference: {
        create: vi.fn().mockResolvedValue(reference),
        findMany: vi.fn(),
      },
    };

    const result = await createReference(client, {
      from: { type: "TASK", id: "task-id" },
      to: { type: "PAGE", id: "page-id" },
      relation: "spec",
    });

    expect(result).toBe(reference);
    expect(client.reference.create).toHaveBeenCalledWith({
      data: {
        fromType: "TASK",
        fromId: "task-id",
        toType: "PAGE",
        toId: "page-id",
        relation: "spec",
      },
    });
  });

  it("normalizes omitted relations to a non-null sentinel", async () => {
    const reference = {
      id: "reference-id",
      fromType: "TASK",
      fromId: "task-id",
      toType: "ATTACHMENT",
      toId: "attachment-id",
      relation: UNLABELED_REFERENCE_RELATION,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    };
    const client = {
      reference: {
        create: vi.fn().mockResolvedValue(reference),
        findMany: vi.fn(),
      },
    };

    await createReference(client, {
      from: { type: "TASK", id: "task-id" },
      to: { type: "ATTACHMENT", id: "attachment-id" },
    });

    expect(client.reference.create).toHaveBeenCalledWith({
      data: {
        fromType: "TASK",
        fromId: "task-id",
        toType: "ATTACHMENT",
        toId: "attachment-id",
        relation: UNLABELED_REFERENCE_RELATION,
      },
    });
  });

  it("lists references by source endpoint", async () => {
    const references = [
      {
        id: "reference-id",
        fromType: "TASK",
        fromId: "task-id",
        toType: "PAGE",
        toId: "page-id",
        relation: UNLABELED_REFERENCE_RELATION,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    const client = {
      reference: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue(references),
      },
    };

    const result = await listReferences(client, {
      from: { type: "TASK", id: "task-id" },
    });

    expect(result).toBe(references);
    expect(client.reference.findMany).toHaveBeenCalledWith({
      where: {
        fromType: "TASK",
        fromId: "task-id",
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("lists references by target endpoint", async () => {
    const client = {
      reference: {
        create: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    await listReferences(client, {
      to: { type: "PAGE", id: "page-id" },
    });

    expect(client.reference.findMany).toHaveBeenCalledWith({
      where: {
        toType: "PAGE",
        toId: "page-id",
      },
      orderBy: { createdAt: "desc" },
    });
  });
});
