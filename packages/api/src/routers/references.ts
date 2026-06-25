import { z } from "zod";
import { createReferencesService } from "../modules/references/index.js";
import { protectedProcedure, router } from "../trpc.js";

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;
const MIN_SEARCH_TERM = 2;

const idSchema = z.string().trim().min(1);
const referenceTypeValues = ["TASK", "PAGE", "APPROVAL", "TRANSACTION"] as const;

const referenceEndpointSchema = z.object({
  type: z.enum(referenceTypeValues),
  id: idSchema,
});

const listInputSchema = z.object({
  from: referenceEndpointSchema,
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const incomingInputSchema = z.object({
  to: referenceEndpointSchema,
  limit: z.number().int().min(1).max(MAX_LIST_LIMIT).default(DEFAULT_LIST_LIMIT),
});

const searchInputsSchema = z.object({
  term: z.string().trim().min(MIN_SEARCH_TERM).max(200),
  limit: z.number().int().min(1).max(MAX_SEARCH_LIMIT).default(DEFAULT_SEARCH_LIMIT),
});

const createInputSchema = z.object({
  from: referenceEndpointSchema,
  to: referenceEndpointSchema,
  relation: z.string().trim().max(80).optional(),
});

export const referencesRouter = router({
  listOutgoing: protectedProcedure.input(listInputSchema).query(async ({ ctx, input }) => {
    return await createReferencesService(ctx.db).listOutgoing({ from: input.from, limit: input.limit });
  }),

  listIncoming: protectedProcedure.input(incomingInputSchema).query(async ({ ctx, input }) => {
    return await createReferencesService(ctx.db).listIncoming({ to: input.to, limit: input.limit });
  }),

  searchTargets: protectedProcedure.input(searchInputsSchema).query(async ({ ctx, input }) => {
    return await createReferencesService(ctx.db).searchTargets({
      term: input.term,
      limit: input.limit,
    });
  }),

  create: protectedProcedure.input(createInputSchema).mutation(async ({ ctx, input }) => {
    return await createReferencesService(ctx.db).create({
      actorId: ctx.user.id,
      from: input.from,
      to: input.to,
      relation: input.relation,
    });
  }),
});
