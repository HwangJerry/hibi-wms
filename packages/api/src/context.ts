import {
  getSessionIdFromCookieHeader,
  validateSession,
  type AuthSession,
  type AuthUser,
} from "@hibi/auth";
import { prisma } from "@hibi/db";
import type { PrismaClient } from "@hibi/db";
import type { CreateFastifyContextOptions } from "@trpc/server/adapters/fastify";
import type { FastifyReply } from "fastify";

export type Session = AuthSession;
export type User = AuthUser;

export type ApiContext = {
  db: PrismaClient;
  res: FastifyReply;
  session: Session | null;
  user: User | null;
};

export async function createContext({
  req,
  res,
}: CreateFastifyContextOptions): Promise<ApiContext> {
  const sessionId = getSessionIdFromCookieHeader(req.headers.cookie);
  const { session, user } = await validateSession(prisma, sessionId);

  return {
    db: prisma,
    res,
    session,
    user,
  };
}
