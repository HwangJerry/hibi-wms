import { z } from "zod";
import { createApprovalService } from "../modules/approval/index.js";
import { protectedProcedure, router } from "../trpc.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;
const approvalStateValues = ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
const approvalTypeValues = ["FINANCIAL", "WORK"] as const;

const idSchema = z.string().trim().min(1);
const listApprovalsInputSchema = z.object({
  state: z.enum(approvalStateValues).optional(),
  type: z.enum(approvalTypeValues).optional(),
  mine: z.boolean().optional(),
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const getApprovalRequestInputSchema = z.object({
  id: idSchema,
});

const createApprovalRequestInputSchema = z.object({
  type: z.enum(approvalTypeValues),
  title: z.string().trim().min(1),
  description: z.string().trim().max(2000).nullable().optional(),
  approverId: idSchema.optional(),
});

const idOnlyInputSchema = z.object({
  id: idSchema,
});

const commentApprovalInputSchema = z.object({
  id: idSchema,
  note: z.string().trim().min(1),
});

const decisionInputSchema = z.object({
  id: idSchema,
  note: z.string().trim().optional(),
});

export const approvalRouter = router({
  count: protectedProcedure.query(async ({ ctx }) => {
    return await createApprovalService(ctx.db).countPendingForUser(ctx.user.id);
  }),

  list: protectedProcedure
    .input(listApprovalsInputSchema)
    .query(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).list({ actorId: ctx.user.id, ...input });
    }),

  get: protectedProcedure
    .input(getApprovalRequestInputSchema)
    .query(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).get(input);
    }),

  create: protectedProcedure
    .input(createApprovalRequestInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).create({
        actorId: ctx.user.id,
        ...input,
      });
    }),

  submit: protectedProcedure
    .input(idOnlyInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).submit({
        actorId: ctx.user.id,
        id: input.id,
      });
    }),

  approve: protectedProcedure
    .input(decisionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).approve({
        actorId: ctx.user.id,
        id: input.id,
        note: input.note,
      });
    }),

  reject: protectedProcedure
    .input(decisionInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).reject({
        actorId: ctx.user.id,
        id: input.id,
        note: input.note,
      });
    }),

  cancel: protectedProcedure
    .input(idOnlyInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).cancel({
        actorId: ctx.user.id,
        id: input.id,
      });
    }),

  comment: protectedProcedure
    .input(commentApprovalInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createApprovalService(ctx.db).comment({
        actorId: ctx.user.id,
        id: input.id,
        note: input.note,
      });
    }),
});
