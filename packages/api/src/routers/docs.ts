import { z } from "zod";
import {
  createDocsService,
} from "../modules/docs/index.js";
import { protectedProcedure, router } from "../trpc.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 100;

const idSchema = z.string().trim().min(1);

const listSpacesInputSchema = z.object({
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const createSpaceInputSchema = z.object({
  name: z.string().trim().min(1),
});

const renameSpaceInputSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1),
});

const softDeleteSpaceInputSchema = z.object({
  id: idSchema,
});

const pagesTreeInputSchema = z.object({
  spaceId: idSchema,
});

const getPageInputSchema = z.object({
  id: idSchema,
});

const createPageInputSchema = z.object({
  spaceId: idSchema,
  parentId: idSchema.nullish(),
  title: z.string().trim().min(1),
});

const renamePageInputSchema = z.object({
  id: idSchema,
  title: z.string().trim().min(1),
});

const movePageInputSchema = z.object({
  id: idSchema,
  parentId: idSchema.nullable().optional(),
});

const reorderPageInputSchema = z.object({
  id: idSchema,
  beforeId: idSchema.optional(),
  afterId: idSchema.optional(),
});

const softDeletePageInputSchema = z.object({
  id: idSchema,
});

const versionsListInputSchema = z.object({
  pageId: idSchema,
  cursor: idSchema.optional(),
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const createVersionInputSchema = z.object({
  pageId: idSchema,
  yDoc: z.string().trim().min(1),
  label: z.string().trim().max(120).optional(),
  textProjection: z.string().trim().max(2000).optional(),
});

const restoreVersionInputSchema = z.object({
  pageId: idSchema,
  versionId: idSchema,
});

export const docsRouter = router({
  spaces: router({
    list: protectedProcedure
      .input(listSpacesInputSchema)
      .query(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).listSpaces(input);
      }),

    create: protectedProcedure
      .input(createSpaceInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).createSpace({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    rename: protectedProcedure
      .input(renameSpaceInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).renameSpace({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    softDelete: protectedProcedure
      .input(softDeleteSpaceInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).softDeleteSpace({
          actorId: ctx.user.id,
          ...input,
        });
      }),
  }),

  pages: router({
    tree: protectedProcedure
      .input(pagesTreeInputSchema)
      .query(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).pagesTree(input);
      }),

    get: protectedProcedure.input(getPageInputSchema).query(async ({ ctx, input }) => {
      return await createDocsService(ctx.db).getPage(input);
    }),

    create: protectedProcedure
      .input(createPageInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).createPage({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    rename: protectedProcedure
      .input(renamePageInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).renamePage({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    move: protectedProcedure
      .input(movePageInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).movePage({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    reorder: protectedProcedure
      .input(reorderPageInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).reorderPage({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    softDelete: protectedProcedure
      .input(softDeletePageInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).softDeletePage({
          actorId: ctx.user.id,
          ...input,
        });
      }),
  }),

  versions: router({
    list: protectedProcedure
      .input(versionsListInputSchema)
      .query(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).listVersions(
          input,
        );
      }),

    snapshot: protectedProcedure
      .input(createVersionInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).createVersion({
          actorId: ctx.user.id,
          ...input,
        });
      }),

    restore: protectedProcedure
      .input(restoreVersionInputSchema)
      .mutation(async ({ ctx, input }) => {
        return await createDocsService(ctx.db).restoreVersion({
          actorId: ctx.user.id,
          ...input,
        });
      }),
  }),
});
