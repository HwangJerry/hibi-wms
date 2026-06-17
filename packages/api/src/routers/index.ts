import { publicProcedure, router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { backlogRouter } from "./backlog.js";

export const appRouter = router({
  auth: authRouter,
  backlog: backlogRouter,
  health: publicProcedure.query(() => ({
    status: "ok" as const,
  })),
});

export type AppRouter = typeof appRouter;
