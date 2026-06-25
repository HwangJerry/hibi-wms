import { argon2id, hash, verify } from "argon2";
import { Lucia, TimeSpan, type Adapter, type DatabaseSession, type DatabaseUser } from "lucia";
import type { PrismaClient } from "@hibi/db";

export const SESSION_COOKIE_NAME = "hibi_session";

declare module "lucia" {
  interface Register {
    Lucia: typeof Lucia;
    DatabaseUserAttributes: {
      email: string;
      name: string;
    };
  }
}

const SESSION_DURATION_IN_DAYS = 30;
const HASH_MEMORY_COST_KIB = 19_456;
const HASH_TIME_COST = 2;
const HASH_PARALLELISM = 1;
const SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE !== "false";
const SESSION_COOKIE_ATTRIBUTES = {
  httpOnly: true,
  secure: SESSION_COOKIE_SECURE,
  sameSite: "lax" as const,
  path: "/",
};

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

type AuthUserAttributes = {
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

type AuthSessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
  user?: AuthUserRecord | null;
};

type AuthUserRecord = {
  id: string;
  email: string;
  name: string;
};

type AuthSessionFindUniqueArgs = Parameters<
  AuthDatabase["session"]["findUnique"]
>[0];
type AuthSessionFindManyArgs = Parameters<
  AuthDatabase["session"]["findMany"]
>[0];
type AuthSessionDeleteManyArgs = Parameters<
  AuthDatabase["session"]["deleteMany"]
>[0];
type AuthSessionUpdateArgs = Parameters<AuthDatabase["session"]["update"]>[0];
type AuthSessionCreateArgs = Parameters<
  AuthDatabase["session"]["create"]
>[0];

const EXPIRES_IN = new TimeSpan(SESSION_DURATION_IN_DAYS, "d");

class AuthSessionAdapter implements Adapter {
  constructor(private readonly db: AuthDatabase) {}

  async getSessionAndUser(sessionId: string): Promise<[DatabaseSession | null, DatabaseUser | null]> {
    const rawSessionResult = await this.db.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    } satisfies AuthSessionFindUniqueArgs);

    if (!rawSessionResult) {
      return [null, null];
    }

    const rawSession = rawSessionResult as AuthSessionRecord;
    const { user: rawUser, ...rawSessionWithoutUser } = rawSession;

    if (!rawUser) {
      return [toDatabaseSession(rawSessionWithoutUser), null];
    }

    return [
      toDatabaseSession(rawSessionWithoutUser),
      toDatabaseUser(rawUser),
    ];
  }

  async getUserSessions(userId: string): Promise<DatabaseSession[]> {
    const rawSessions = await this.db.session.findMany({
      where: {
        userId,
      },
    } satisfies AuthSessionFindManyArgs);

    return rawSessions.map((session) =>
      toDatabaseSession(session as AuthSessionRecord),
    );
  }

  async setSession(value: DatabaseSession): Promise<void> {
    await this.db.session.create({
      data: {
        id: value.id,
        userId: value.userId,
        expiresAt: value.expiresAt,
        ...value.attributes,
      },
    } satisfies AuthSessionCreateArgs);
  }

  async updateSessionExpiration(sessionId: string, expiresAt: Date): Promise<void> {
    await this.db.session.update({
      where: {
        id: sessionId,
      },
      data: {
        expiresAt,
      },
    } satisfies AuthSessionUpdateArgs);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.db.session.deleteMany({
      where: {
        id: sessionId,
      },
    } satisfies AuthSessionDeleteManyArgs);
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.session.deleteMany({
      where: {
        userId,
      },
    } satisfies AuthSessionDeleteManyArgs);
  }

  async deleteExpiredSessions(): Promise<void> {
    await this.db.session.deleteMany({
      where: {
        expiresAt: {
          lte: new Date(),
        },
      },
    } satisfies AuthSessionDeleteManyArgs);
  }
}

type EmptySessionAttributes = Record<string, never>;

function createLuciaAuth(db: AuthDatabase): Lucia<EmptySessionAttributes, AuthUserAttributes> {
  return new Lucia<EmptySessionAttributes, AuthUserAttributes>(new AuthSessionAdapter(db), {
    sessionExpiresIn: EXPIRES_IN,
    sessionCookie: {
      name: SESSION_COOKIE_NAME,
      attributes: SESSION_COOKIE_ATTRIBUTES,
    },
    getUserAttributes: (databaseUserAttributes) => {
      return {
        email: databaseUserAttributes.email,
        name: databaseUserAttributes.name,
      };
    },
  });
}

const cookieAuth = new Lucia<EmptySessionAttributes, AuthUserAttributes>(
  {
    getSessionAndUser: () => Promise.resolve([null, null]),
    getUserSessions: () => Promise.resolve([]),
    setSession: () => Promise.resolve(),
    updateSessionExpiration: () => Promise.resolve(),
    deleteSession: () => Promise.resolve(),
    deleteUserSessions: () => Promise.resolve(),
    deleteExpiredSessions: () => Promise.resolve(),
  },
  {
    sessionCookie: {
      name: SESSION_COOKIE_NAME,
      attributes: SESSION_COOKIE_ATTRIBUTES,
    },
  },
);

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
  const lucia = createLuciaAuth(db);
  const session = await lucia.createSession(userId, {});

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

export function createSessionCookie(sessionId: string, _expiresAt?: Date): string {
  return cookieAuth.createSessionCookie(sessionId).serialize();
}

export function createBlankSessionCookie(): string {
  return cookieAuth.createBlankSessionCookie().serialize();
}

export async function validateSession(
  db: AuthDatabase,
  sessionId: string | null,
): Promise<SessionValidationResult> {
  if (!sessionId) {
    return { session: null, user: null };
  }

  const lucia = createLuciaAuth(db);
  const { user, session } = await lucia.validateSession(sessionId);
  const authUser = user as AuthUser | null;

  if (!session || !authUser) {
    return { session: null, user: null };
  }

  return {
    session: {
      id: session.id,
      userId: session.userId,
      expiresAt: session.expiresAt,
    },
    user: {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name,
    },
  };
}

function toDatabaseSession(session: Omit<AuthSessionRecord, "user">): DatabaseSession {
  return {
    id: session.id,
    userId: session.userId,
    expiresAt: session.expiresAt,
    attributes: {},
  };
}

function toDatabaseUser(
  user: { id: string; email: string; name: string },
): DatabaseUser {
  const { id, ...attributes } = user;

  return {
    id,
    attributes,
  };
}
