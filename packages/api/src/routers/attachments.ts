import { z } from "zod";
import { createAttachmentsService } from "../modules/attachments/index.js";
import { protectedProcedure, router } from "../trpc.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const idSchema = z.string().trim().min(1);
const attachmentTargetSchema = z.object({
  type: z.enum(["TASK", "PAGE"]),
  id: idSchema,
});

const createUploadInputSchema = z.object({
  fileName: z.string().trim().min(1).max(120),
  mimeType: z.string().trim().min(1),
  sizeBytes: z.number().int().min(1),
  target: attachmentTargetSchema.optional(),
});

const listInputSchema = z.object({
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
  target: attachmentTargetSchema.optional(),
});

export const attachmentsRouter = router({
  createUploadIntent: protectedProcedure
    .input(createUploadInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createAttachmentsService(ctx.db).createUploadIntent({
        actorId: ctx.user.id,
        ...input,
      });
    }),

  list: protectedProcedure
    .input(listInputSchema)
    .query(async ({ ctx, input }) => {
      return await createAttachmentsService(ctx.db).list({
        actorId: ctx.user.id,
        ...input,
      });
    }),
});
