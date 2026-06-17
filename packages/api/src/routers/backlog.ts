import { Priority, TaskStatus } from "@hibi/db";
import { z } from "zod";
import { createBacklogService } from "../modules/backlog/index.js";
import { protectedProcedure, router } from "../trpc.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const taskStatusSchema = z.enum(TaskStatus);
const prioritySchema = z.enum(Priority);
const idSchema = z.string().min(1);

const listTasksInputSchema = z.object({
  status: taskStatusSchema.optional(),
  assigneeId: idSchema.nullish(),
  parentId: idSchema.nullish(),
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const getTaskInputSchema = z.object({
  id: idSchema,
});

const createTaskInputSchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  priority: prioritySchema.optional(),
  assigneeId: idSchema.nullish(),
  parentId: idSchema.nullish(),
});

const updateTaskInputSchema = z.object({
  id: idSchema,
  patch: z
    .object({
      title: z.string().trim().min(1).optional(),
      description: z.string().trim().min(1).nullable().optional(),
      priority: prioritySchema.optional(),
      assigneeId: idSchema.nullish(),
      parentId: idSchema.nullish(),
    })
    .refine((patch) => Object.keys(patch).length > 0, {
      message: "At least one field must be provided.",
    }),
});

const reorderTaskInputSchema = z.object({
  id: idSchema,
  beforeId: idSchema.optional(),
  afterId: idSchema.optional(),
});

const setTaskStatusInputSchema = z.object({
  id: idSchema,
  status: taskStatusSchema,
});

const softDeleteTaskInputSchema = z.object({
  id: idSchema,
});

export const backlogRouter = router({
  list: protectedProcedure.input(listTasksInputSchema).query(async ({ ctx, input }) => {
    return await createBacklogService(ctx.db).list(input);
  }),

  get: protectedProcedure.input(getTaskInputSchema).query(async ({ ctx, input }) => {
    return await createBacklogService(ctx.db).get(input);
  }),

  create: protectedProcedure.input(createTaskInputSchema).mutation(async ({ ctx, input }) => {
    return await createBacklogService(ctx.db).create({
      actorId: ctx.user.id,
      ...input,
    });
  }),

  update: protectedProcedure.input(updateTaskInputSchema).mutation(async ({ ctx, input }) => {
    return await createBacklogService(ctx.db).update(input);
  }),

  reorder: protectedProcedure.input(reorderTaskInputSchema).mutation(async ({ ctx, input }) => {
    return await createBacklogService(ctx.db).reorder(input);
  }),

  setStatus: protectedProcedure
    .input(setTaskStatusInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createBacklogService(ctx.db).setStatus(input);
    }),

  softDelete: protectedProcedure
    .input(softDeleteTaskInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createBacklogService(ctx.db).softDelete({
        actorId: ctx.user.id,
        id: input.id,
      });
    }),
});
