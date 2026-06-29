import { afterEach, describe, expect, it } from "vitest";
import { EntityType, type Attachment, type Prisma } from "@hibi/db";
import { AttachmentsService, type AttachmentsServiceDb } from "./service.js";

type ReferenceRecord = {
  id: string;
  fromType: EntityType;
  fromId: string;
  toType: EntityType;
  toId: string;
  relation: string;
  createdAt: Date;
};

type AttachmentFindManyArgs = Prisma.AttachmentFindManyArgs;
type ReferenceFindManyArgs = Prisma.ReferenceFindManyArgs;

class InMemoryAttachmentsDb {
  readonly attachments: Attachment[] = [];
  readonly references: ReferenceRecord[] = [];

  readonly attachment = {
    findMany: (args: AttachmentFindManyArgs) => {
      const rows = this.attachments.filter((attachment) => {
        const idFilter = args.where?.id;
        if (typeof idFilter === "object" && "in" in idFilter) {
          return idFilter.in?.includes(attachment.id) ?? false;
        }

        if (args.where?.uploaderId && attachment.uploaderId !== args.where.uploaderId) {
          return false;
        }

        return true;
      });

      return Promise.resolve(rows);
    },
    findFirst: () => Promise.resolve(null),
    create: () => {
      throw new Error("create is not implemented for this test.");
    },
  };

  readonly reference = {
    findMany: (args: ReferenceFindManyArgs) => {
      const rows = this.references.filter((reference) => {
        if (args.where?.fromType && reference.fromType !== args.where.fromType) {
          return false;
        }

        if (args.where?.toType && reference.toType !== args.where.toType) {
          return false;
        }

        if (args.where?.toId && reference.toId !== args.where.toId) {
          return false;
        }

        if (args.where?.relation && reference.relation !== args.where.relation) {
          return false;
        }

        return true;
      });

      return Promise.resolve(rows as Array<Prisma.ReferenceGetPayload<object>>);
    },
    create: () => {
      throw new Error("create is not implemented for this test.");
    },
  };

  readonly task = {
    findFirst: () => Promise.resolve(null),
  };

  readonly page = {
    findFirst: () => Promise.resolve(null),
  };

  $transaction<T>(fn: (tx: never) => Promise<T>): Promise<T> {
    return fn(this as never);
  }

  toServiceDb(): AttachmentsServiceDb {
    return this as unknown as AttachmentsServiceDb;
  }
}

const r2EnvKeys = [
  "R2_BUCKET_NAME",
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
] as const;

function clearR2Env() {
  for (const key of r2EnvKeys) {
    delete process.env[key];
  }
}

afterEach(() => {
  clearR2Env();
});

describe("AttachmentsService", () => {
  it("returns an empty target attachment list without requiring R2 configuration", async () => {
    clearR2Env();

    const db = new InMemoryAttachmentsDb();
    const service = new AttachmentsService(db.toServiceDb());

    await expect(
      service.list({
        actorId: "user-1",
        target: {
          type: "PAGE",
          id: "page-1",
        },
      }),
    ).resolves.toEqual({
      items: [],
    });
  });
});
