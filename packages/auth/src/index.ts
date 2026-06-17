import { randomBytes } from "node:crypto";
import { argon2id, hash, verify } from "argon2";
import type { PrismaClient } from "@hibi/db";

export const SESSION_COOKIE_NAME = "hibi_session";

const SESSION_ID_BYTES = 32;
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 30;
const EXPIRED_COOKIE_DATE = new Date(0);
const HASH_MEMORY_COST_KIB = 19_456;
const HASH_TIME_COST = 2;
const HASH_PARALLELISM = 1;

export type AuthSession = {
  id: string;
  userId: string;
  expiresAt: Date;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export type SessionValidationResult =
  | {
      session: AuthSession;
      user: AuthUser;
    }
  | {
      session: null;
      user: null;
    };

export type AuthDatabase = Pick<PrismaClient, "session">;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, {
    type: argon2id,
    memoryCost: HASH_MEMORY_COST_KIB,
    timeCost: HASH_TIME_COST,
    parallelism: HASH_PARALLELISM,
  });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return verify(passwordHash, password);
}

export async function createSession(
  db: AuthDatabase,
  userId: string,
): Promise<AuthSession> {
  const sessionId = generateSessionId();
  const expiresAt = getSessionExpiresAt(new Date());
  const session = await db.session.create({
    data: {
      id: sessionId,
      userId,
      expiresAt,
    },
  });

  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
  };
}

export async function invalidateSession(
  db: AuthDatabase,
  sessionId: string,
): Promise<void> {
  await db.session.deleteMany({
    where: { id: sessionId },
  });
}

function normalizeCookieHeader(cookieHeader: string | string[] | undefined) {
  if (Array.isArray(cookieHeader)) {
    return cookieHeader.join("; ");
  }

  return cookieHeader;
}

export function getSessionIdFromCookieHeader(
  cookieHeader: string | string[] | undefined,
): string | null {
  const normalizedCookieHeader = normalizeCookieHeader(cookieHeader);
  if (!normalizedCookieHeader) {
    return null;
  }

  const cookies = normalizedCookieHeader.split(";");
  for (const cookie of cookies) {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");
    const name = rawName?.trim();
    if (name !== SESSION_COOKIE_NAME) {
      continue;
    }

    const rawValue = rawValueParts.join("=");
    if (!rawValue) {
      return null;
    }

    try {
      return decodeURIComponent(rawValue);
    } catch {
      return null;
    }
  }

  return null;
}

export function createSessionCookie(sessionId: string, expiresAt: Date): string {
  const maxAgeSeconds = Math.max(
    0,
    Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  );

  return serializeSessionCookie(encodeURIComponent(sessionId), {
    expiresAt,
    maxAgeSeconds,
  });
}

export function createBlankSessionCookie(): string {
  return serializeSessionCookie("", {
    expiresAt: EXPIRED_COOKIE_DATE,
    maxAgeSeconds: 0,
  });
}

export async function validateSession(
  db: AuthDatabase,
  sessionId: string | null,
): Promise<SessionValidationResult> {
  if (!sessionId) {
    return { session: null, user: null };
  }

  const session = await db.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session || session.expiresAt <= new Date()) {
    if (session) {
      await invalidateSession(db, session.id);
    }

    return { session: null, user: null };
  }

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    },
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
    },
  };
}

function generateSessionId(): string {
  return randomBytes(SESSION_ID_BYTES).toString("base64url");
}

function getSessionExpiresAt(createdAt: Date): Date {
  return new Date(createdAt.getTime() + SESSION_DURATION_MS);
}

function serializeSessionCookie(
  value: string,
  options: {
    expiresAt: Date;
    maxAgeSeconds: number;
  },
): string {
  return [
    `${SESSION_COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Expires=${options.expiresAt.toUTCString()}`,
    `Max-Age=${options.maxAgeSeconds}`,
  ].join("; ");
}
