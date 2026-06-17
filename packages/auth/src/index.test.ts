import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createBlankSessionCookie,
  createSession,
  createSessionCookie,
  getSessionIdFromCookieHeader,
  invalidateSession,
  SESSION_COOKIE_NAME,
  validateSession,
  type AuthDatabase,
} from "./index.js";

type FakeUserRecord = {
  id: string;
  email: string;
  name: string;
};

type FakeSessionRecord = {
  id: string;
  userId: string;
  expiresAt: Date;
};

type SessionCreateArgs = {
  data: FakeSessionRecord;
};

type SessionFindUniqueArgs = {
  where: {
    id: string;
  };
  include?: {
    user: true;
  };
};

type SessionDeleteManyArgs = {
  where: {
    id?: string;
    userId?: string;
    expiresAt?: {
      lte: Date;
    };
  };
};

type SessionFindManyArgs = {
  where: {
    userId?: string;
    expiresAt?: {
      lte: Date;
    };
  };
};

type SessionUpdateArgs = {
  where: {
    id: string;
  };
  data: {
    expiresAt: Date;
  };
};

function createFakeAuthDb() {
  const users = new Map<string, FakeUserRecord>();
  const sessions = new Map<string, FakeSessionRecord>();

  const db = {
    session: {
      create(args: SessionCreateArgs) {
        sessions.set(args.data.id, args.data);
        return Promise.resolve(args.data);
      },
      findUnique(args: SessionFindUniqueArgs) {
        const session = sessions.get(args.where.id);
        if (!session) {
          return Promise.resolve(null);
        }

        const user = users.get(session.userId);
        if (args.include?.user && !user) {
          return Promise.resolve(null);
        }

        if (!args.include?.user) {
          return Promise.resolve(session);
        }

        return Promise.resolve({
          ...session,
          user,
        });
      },
      findMany(args: SessionFindManyArgs) {
        const filteredSessions = [...sessions.values()].filter((session) => {
          if (args.where.userId && session.userId !== args.where.userId) {
            return false;
          }

          if (args.where.expiresAt && session.expiresAt > args.where.expiresAt.lte) {
            return false;
          }

          return true;
        });

        return Promise.resolve(filteredSessions);
      },
      deleteMany(args: SessionDeleteManyArgs) {
        let deletedCount = 0;
        for (const [id, session] of sessions) {
          const shouldDeleteById = args.where.id !== undefined && id === args.where.id;
          const shouldDeleteByUserId =
            args.where.userId !== undefined && session.userId === args.where.userId;
          const shouldDeleteByExpiration =
            args.where.expiresAt !== undefined &&
            session.expiresAt <= args.where.expiresAt.lte;

          if (shouldDeleteById || shouldDeleteByUserId || shouldDeleteByExpiration) {
            sessions.delete(id);
            deletedCount += 1;
          }
        }

        return Promise.resolve({ count: deletedCount });
      },
      update(args: SessionUpdateArgs) {
        const session = sessions.get(args.where.id);
        if (!session) {
          return Promise.reject(new Error("Session not found"));
        }

        sessions.set(args.where.id, {
          ...session,
          expiresAt: args.data.expiresAt,
        });

        return Promise.resolve({
          ...session,
          ...args.data,
        });
      },
    },
  } as unknown as AuthDatabase;

  return {
    db,
    users,
    sessions,
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("getSessionIdFromCookieHeader", () => {
  it("returns the decoded configured session cookie value", () => {
    const sessionId = getSessionIdFromCookieHeader(
      `theme=dark; ${SESSION_COOKIE_NAME}=session%3A123; locale=en`,
    );

    expect(sessionId).toBe("session:123");
  });

  it("returns null when the session cookie is missing or malformed", () => {
    expect(getSessionIdFromCookieHeader("theme=dark")).toBeNull();
    expect(
      getSessionIdFromCookieHeader(`${SESSION_COOKIE_NAME}=%E0%A4%A`),
    ).toBeNull();
  });
});

describe("session cookies", () => {
  it("creates secure http-only session cookies", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const cookie = createSessionCookie("session:123");

    expect(cookie).toBe(
      `${SESSION_COOKIE_NAME}=session%3A123; HttpOnly; Max-Age=2592000; Path=/; SameSite=Lax; Secure`,
    );
  });

  it("creates secure http-only blank cookies for logout", () => {
    const cookie = createBlankSessionCookie();

    expect(cookie).toBe(
      `${SESSION_COOKIE_NAME}=; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure`,
    );
  });
});

describe("session lifecycle", () => {
  it("creates and validates an active session", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const { db, users } = createFakeAuthDb();
    users.set("user-1", {
      id: "user-1",
      email: "alex@example.com",
      name: "Alex",
    });

    const session = await createSession(db, "user-1");
    const result = await validateSession(db, session.id);

    expect(session.id).toHaveLength(40);
    expect(session.userId).toBe("user-1");
    expect(session.expiresAt).toEqual(new Date("2026-01-31T00:00:00.000Z"));
    expect(result).toEqual({
      session,
      user: {
        id: "user-1",
        email: "alex@example.com",
        name: "Alex",
      },
    });
  });

  it("invalidates a session", async () => {
    const { db, users } = createFakeAuthDb();
    users.set("user-1", {
      id: "user-1",
      email: "alex@example.com",
      name: "Alex",
    });

    const session = await createSession(db, "user-1");
    await invalidateSession(db, session.id);

    await expect(validateSession(db, session.id)).resolves.toEqual({
      session: null,
      user: null,
    });
  });

  it("rejects and deletes expired sessions", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));

    const { db, sessions, users } = createFakeAuthDb();
    users.set("user-1", {
      id: "user-1",
      email: "alex@example.com",
      name: "Alex",
    });
    sessions.set("expired-session", {
      id: "expired-session",
      userId: "user-1",
      expiresAt: new Date("2026-01-31T23:59:59.999Z"),
    });

    await expect(validateSession(db, "expired-session")).resolves.toEqual({
      session: null,
      user: null,
    });
    expect(sessions.has("expired-session")).toBe(false);
  });
});
