import { z } from "zod";
import { createSearchService } from "../modules/search/index.js";
import { protectedProcedure, router } from "../trpc.js";

const searchInputSchema = z.object({
  term: z.string().trim().min(1).max(200),
  limit: z.number().int().min(1).max(20).optional(),
});

export const searchRouter = router({
  global: protectedProcedure.input(searchInputSchema).query(async ({ ctx, input }) => {
    return await createSearchService(ctx.db).global(input);
  }),
});

