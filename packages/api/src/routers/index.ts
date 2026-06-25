import { publicProcedure, router } from "../trpc.js";
import { authRouter } from "./auth.js";
import { backlogRouter } from "./backlog.js";
import { docsRouter } from "./docs.js";
import { attachmentsRouter } from "./attachments.js";
import { approvalRouter } from "./approval.js";
import { financeRouter } from "./finance.js";
import { notificationRouter } from "./notifications.js";
import { searchRouter } from "./search.js";
import { referencesRouter } from "./references.js";

export const appRouter = router({
  auth: authRouter,
  backlog: backlogRouter,
  attachments: attachmentsRouter,
  docs: docsRouter,
  search: searchRouter,
  approval: approvalRouter,
  finance: financeRouter,
  references: referencesRouter,
  notification: notificationRouter,
  health: publicProcedure.query(() => ({
    status: "ok" as const,
  })),
});

export type AppRouter = typeof appRouter;
