import { isAppError } from "@hibi/core";
import { initTRPC, TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";
import type { ApiContext } from "./context.js";

const appErrorCodeToTRPCCode = {
  BAD_REQUEST: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  INTERNAL: "INTERNAL_SERVER_ERROR",
  NOT_FOUND: "NOT_FOUND",
} as const satisfies Record<string, TRPC_ERROR_CODE_KEY>;

const t = initTRPC.context<ApiContext>().create();

const errorMappingMiddleware = t.middleware(async ({ next }) => {
  try {
    const result = await next();
    if (!result.ok) {
      throw mapToTRPCError(result.error);
    }

    return result;
  } catch (error) {
    throw mapToTRPCError(error);
  }
});

export const router = t.router;
export const publicProcedure = t.procedure.use(errorMappingMiddleware);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      user: ctx.user,
    },
  });
});

export function mapToTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (isAppError(error)) {
    return new TRPCError({
      code: appErrorCodeToTRPCCode[error.code],
      message: error.message,
      cause: error.cause,
    });
  }

  return new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    cause: error,
  });
}
