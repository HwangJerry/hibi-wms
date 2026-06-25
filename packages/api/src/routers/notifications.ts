import { NotificationType } from "@hibi/db";
import { z } from "zod";
import {
  createNotificationService,
} from "../modules/notifications/index.js";
import { protectedProcedure, router } from "../trpc.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const idSchema = z.string().trim().min(1);

const listInputSchema = z.object({
  unreadOnly: z.boolean().optional(),
  type: z.nativeEnum(NotificationType).optional(),
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const markAsReadInputSchema = z.object({
  ids: z.array(idSchema).min(1),
});

export const notificationRouter = router({
  list: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    return await createNotificationService(ctx.db).list({
      actorId: ctx.user.id,
      ...input,
    });
  }),

  markAsRead: protectedProcedure
    .input(markAsReadInputSchema)
    .mutation(async ({ ctx, input }) => {
      return await createNotificationService(ctx.db).markAsRead({
        actorId: ctx.user.id,
        ids: input.ids,
      });
    }),

  markAllAsRead: protectedProcedure.mutation(async ({ ctx }) => {
    return await createNotificationService(ctx.db).markAllAsRead({
      actorId: ctx.user.id,
    });
  }),
});
