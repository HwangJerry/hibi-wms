import {
  badRequest,
  createPresignedDownloadIntent,
  createPresignedUploadIntent,
  createAttachmentObjectKey,
  getAttachmentValidationLimits,
  getR2BucketConfigFromEnv,
  notFound,
  writeAuditLog,
} from "@hibi/core";
import { EntityType, type Attachment, type Prisma } from "@hibi/db";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const ATTACHMENT_REFERENCE_RELATION = "ui_attachment";

const ATTACHMENT_TARGET_TYPES = ["TASK", "PAGE"] as const;

export type AttachmentTarget = {
  type: "TASK" | "PAGE";
  id: string;
};

export type AttachmentListInput = {
  actorId: string;
  cursor?: string;
  limit?: number;
  target?: AttachmentTarget;
};

export type CreateUploadInput = {
  actorId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  target?: AttachmentTarget;
};

export type AttachmentWithDownload = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
  downloadUrl: string;
};

export type AttachmentListResult = {
  items: Array<AttachmentWithDownload>;
  nextCursor?: string;
};

export type AttachmentUploadIntent = {
  attachment: AttachmentWithDownload;
  uploadUrl: string;
  uploadHeaders: Record<string, string>;
  uploadExpiresAt: string;
};

type AttachmentDelegate = {
  create(args: {
    data: Prisma.AttachmentCreateInput;
  }): Promise<Attachment>;
  findMany(args: Prisma.AttachmentFindManyArgs): Promise<Array<Attachment>>;
  findFirst(args: Prisma.AttachmentFindFirstArgs): Promise<Attachment | null>;
};

type ReferenceDelegate = {
  create(args: {
    data: Prisma.ReferenceCreateInput;
  }): Promise<Prisma.ReferenceGetPayload<object>>;
  findMany(args: Prisma.ReferenceFindManyArgs): Promise<Array<Prisma.ReferenceGetPayload<object>>>;
};

type TaskFinder = {
  findFirst(args: Prisma.TaskFindFirstArgs): Promise<Pick<{ id: string }, "id"> | null>;
};

type PageFinder = {
  findFirst(args: Prisma.PageFindFirstArgs): Promise<Pick<{ id: string }, "id"> | null>;
};

type AuditLogDelegate = {
  create(args: {
    data: Prisma.AuditLogCreateInput;
  }): Promise<Prisma.AuditLogGetPayload<object>>;
};

type AttachmentsTransaction = {
  attachment: AttachmentDelegate;
  reference: ReferenceDelegate;
  task: TaskFinder;
  page: PageFinder;
} & {
  auditLog: AuditLogDelegate;
};

export type AttachmentsServiceDb = {
  $transaction<T>(fn: (tx: AttachmentsTransaction) => Promise<T>): Promise<T>;
  attachment: AttachmentDelegate;
  reference: ReferenceDelegate;
  task: TaskFinder;
  page: PageFinder;
};

const isAttachmentTargetType = (value: string): value is AttachmentTarget["type"] => {
  return ATTACHMENT_TARGET_TYPES.includes(value as AttachmentTarget["type"]);
};

export class AttachmentsService {
  constructor(private readonly db: AttachmentsServiceDb) {}

  async createUploadIntent(input: CreateUploadInput): Promise<AttachmentUploadIntent> {
    this.validateUploadInput(input);

    const objectKey = createAttachmentObjectKey({
      uploaderId: input.actorId,
      fileName: input.fileName,
    });

    return await this.db.$transaction(async (tx) => {
      const attachment = await tx.attachment.create({
        data: {
          uploaderId: input.actorId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          r2Key: objectKey,
        },
      });

      if (input.target) {
        await assertAttachmentTargetExists(tx, input.target);
        await tx.reference.create({
          data: {
            fromType: EntityType.ATTACHMENT,
            fromId: attachment.id,
            toType: input.target.type,
            toId: input.target.id,
            relation: ATTACHMENT_REFERENCE_RELATION,
          },
        });
      }

      await writeAuditLog(tx, {
        actorId: input.actorId,
        action: "attachment.upload_intent_created",
        entityType: EntityType.ATTACHMENT,
        entityId: attachment.id,
        data: {
          fileName: attachment.fileName,
          target: input.target,
          r2Key: attachment.r2Key,
        },
      });

      const config = getR2BucketConfigFromEnv();
      const presignedUpload = await createPresignedUploadIntent({
        config,
        objectKey: attachment.r2Key,
        contentType: attachment.mimeType,
      });

      return {
        attachment: {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          createdAt: attachment.createdAt,
          downloadUrl: presignedUpload.downloadUrl,
        },
        uploadUrl: presignedUpload.uploadUrl,
        uploadHeaders: presignedUpload.uploadHeaders,
        uploadExpiresAt: presignedUpload.expiresAt,
      };
    });
  }

  async list(input: AttachmentListInput): Promise<AttachmentListResult> {
    const limit = normalizeAttachmentListInput(input.limit);
    const config = getR2BucketConfigFromEnv();
    const attachmentRows = input.target
      ? await this.listByTarget({ target: input.target, cursor: input.cursor, limit })
      : await this.listByUploader({ ...input, limit });

    const items = await Promise.all(
      attachmentRows.items.map(async (attachment) => {
        const signedDownload = await createPresignedDownloadIntent({
          config,
          objectKey: attachment.r2Key,
        });

        return {
          id: attachment.id,
          fileName: attachment.fileName,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          createdAt: attachment.createdAt,
          downloadUrl: signedDownload.downloadUrl,
        };
      }),
    );

    return {
      items,
      nextCursor: attachmentRows.nextCursor,
    };
  }

  private async listByTarget(input: {
    target: AttachmentTarget;
    limit: number;
    cursor?: string;
  }): Promise<{ items: Array<Attachment>; nextCursor?: string }> {
    const take = input.limit + 1;

    const references = await this.db.reference.findMany({
      where: {
        fromType: EntityType.ATTACHMENT,
        toType: input.target.type,
        toId: input.target.id,
        relation: ATTACHMENT_REFERENCE_RELATION,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
    });

    const referenceIds = references.map((reference) => reference.fromId);
    if (referenceIds.length === 0) {
      return { items: [] };
    }

    const attachmentRows = await this.db.attachment.findMany({
      where: {
        id: { in: referenceIds },
      },
    });

    const attachmentById = new Map(
      attachmentRows.map((attachment) => [attachment.id, attachment]),
    );

    const items = referenceIds
      .map((id) => attachmentById.get(id))
      .filter((attachment): attachment is Attachment => Boolean(attachment));

    const nextCursor = references.length > input.limit ? references.at(-1)?.id : undefined;

    return {
      items: items.slice(0, input.limit),
      nextCursor,
    };
  }

  private async listByUploader(input: {
    actorId: string;
    limit: number;
    cursor?: string;
  }): Promise<{ items: Array<Attachment>; nextCursor?: string }> {
    const take = input.limit + 1;

    const rows = await this.db.attachment.findMany({
      where: {
        uploaderId: input.actorId,
      },
      orderBy: [
        { createdAt: "desc" },
        { id: "desc" },
      ],
      take,
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : undefined,
    });

    const items = rows.slice(0, input.limit);
    const nextCursor = rows.length > input.limit ? rows.at(-1)?.id : undefined;

    return {
      items,
      nextCursor,
    };
  }

  private validateUploadInput(input: CreateUploadInput) {
    const limits = getAttachmentValidationLimits();

    if (!input.fileName || input.fileName.trim().length === 0) {
      throw badRequest("File name cannot be empty.");
    }

    if (input.fileName.length > limits.maxFileNameLength) {
      throw badRequest("File name is too long.");
    }

    if (!input.mimeType || input.mimeType.trim().length === 0) {
      throw badRequest("MIME type cannot be empty.");
    }

    if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
      throw badRequest("Attachment size must be greater than zero.");
    }

    if (input.sizeBytes > limits.maxSizeBytes) {
      throw badRequest("Attachment is too large.");
    }

    if (input.target === undefined) {
      return;
    }

    if (input.target.id.trim().length === 0) {
      throw badRequest("Target id cannot be empty.");
    }

    if (!isAttachmentTargetType(input.target.type)) {
      throw badRequest("Target must be TASK or PAGE.");
    }
  }
}

export function createAttachmentsService(db: AttachmentsServiceDb) {
  return new AttachmentsService(db);
}

export function normalizeAttachmentListInput(limit?: number): number {
  if (limit === undefined) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_LIST_LIMIT);
}

async function assertAttachmentTargetExists(
  tx: Pick<AttachmentsTransaction, "task" | "page">,
  target: AttachmentTarget,
) {
  const targetExists = await getAttachmentTarget(tx, target);
  if (!targetExists) {
    throw notFound("Target not found.");
  }
}

async function getAttachmentTarget(
  tx: Pick<AttachmentsTransaction, "task" | "page">,
  target: AttachmentTarget,
) {
  if (target.type === "TASK") {
    const task = await tx.task.findFirst({
      where: {
        id: target.id,
        deletedAt: null,
      },
      select: { id: true },
    });

    return task;
  }

  const page = await tx.page.findFirst({
    where: {
      id: target.id,
      deletedAt: null,
    },
    select: { id: true },
  });

  return page;
}
