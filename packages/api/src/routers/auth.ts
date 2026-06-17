import {
  createBlankSessionCookie,
  createSession,
  createSessionCookie,
  invalidateSession,
  verifyPassword,
} from "@hibi/auth";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../trpc.js";

const loginInputSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

async function checkPasswordHash(passwordHash: string, password: string) {
  try {
    return await verifyPassword(passwordHash, password);
  } catch {
    return false;
  }
}

export const authRouter = router({
  me: protectedProcedure.query(({ ctx }) => ({
    user: ctx.user,
  })),

  login: publicProcedure.input(loginInputSchema).mutation(async ({ ctx, input }) => {
    const user = await ctx.db.user.findUnique({
      where: { email: input.email },
      select: {
        id: true,
        email: true,
        name: true,
        passwordHash: true,
      },
    });

    const hasValidCredentials = user
      ? await checkPasswordHash(user.passwordHash, input.password)
      : false;

    if (!user || !hasValidCredentials) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid email or password.",
      });
    }

    const session = await createSession(ctx.db, user.id);
    ctx.res.header("Set-Cookie", createSessionCookie(session.id, session.expiresAt));

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    };
  }),

  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await invalidateSession(ctx.db, ctx.session.id);
    ctx.res.header("Set-Cookie", createBlankSessionCookie());

    return {
      ok: true,
    };
  }),
});
