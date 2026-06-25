import { Database } from "@hocuspocus/extension-database";
import { Server } from "@hocuspocus/server";
import { getSessionIdFromCookieHeader, validateSession } from "@hibi/auth";
import { prisma } from "@hibi/db";
import type { IncomingMessage, ServerResponse } from "node:http";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3001;
const HEALTH_PATH = "/health";
const DEBOUNCE_MILLISECONDS = 2500;
const MAX_DEBOUNCE_MILLISECONDS = 10000;

function getPort() {
  const rawPort = process.env.REALTIME_PORT;
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port)) {
    throw new Error("REALTIME_PORT must be a valid number.");
  }

  return port;
}

function getHost() {
  return process.env.REALTIME_HOST ?? DEFAULT_HOST;
}

async function authorizePageAccess(documentName: string) {
  const page = await prisma.page.findFirst({
    where: {
      id: documentName,
      deletedAt: null,
    },
    select: {
      id: true,
    },
  });

  return Boolean(page);
}

function getSessionIdFromToken({
  token,
  requestHeaders,
}: {
  token: string;
  requestHeaders: {
    get: (key: string) => string | null;
  };
}) {
  const trimmedToken = token.trim();
  if (trimmedToken.length > 0) {
    if (trimmedToken.startsWith("Bearer ")) {
      return trimmedToken.replace("Bearer ", "");
    }

    return trimmedToken;
  }

  const sessionCookie = requestHeaders.get("cookie");
  if (!sessionCookie) {
    return null;
  }

  return getSessionIdFromCookieHeader(sessionCookie);
}

const server = new Server({
  address: getHost(),
  port: getPort(),
  debounce: DEBOUNCE_MILLISECONDS,
  maxDebounce: MAX_DEBOUNCE_MILLISECONDS,
  extensions: [
    new Database({
    async fetch({ documentName }: { documentName: string }) {
        const page = await prisma.page.findUnique({
          where: { id: documentName },
          select: { yDoc: true, deletedAt: true },
        });

        if (!page || page.deletedAt !== null) {
          return null;
        }

        return new Uint8Array(page.yDoc);
      },
      async store({
        documentName,
        state,
      }: {
        documentName: string;
        state: Uint8Array;
      }) {
        const hasAccess = await authorizePageAccess(documentName);
        if (!hasAccess) {
          throw new Error("Cannot persist document: page does not exist.");
        }

        await prisma.page.update({
          where: { id: documentName },
          data: { yDoc: Buffer.from(state) },
        });
      },
    }),
  ],
  async onAuthenticate({
    documentName,
    requestHeaders,
    token,
  }: {
    documentName: string;
    requestHeaders: {
      get: (key: string) => string | null;
    };
    token: string;
  }) {
    const sessionId = getSessionIdFromToken({ token, requestHeaders });
    const { session, user } = await validateSession(prisma, sessionId);
    if (!session || !user) {
      throw new Error("Unauthorized");
    }

    const hasPageAccess = await authorizePageAccess(documentName);
    if (!hasPageAccess) {
      throw new Error("Forbidden");
    }

    return {
      userId: user.id,
      userName: user.name,
      scope: "read-write" as const,
    };
  },
  onRequest({
    request,
    response,
  }: {
    request: IncomingMessage;
    response: ServerResponse;
  }) {
    const requestPath = request.url?.split("?")[0] ?? "";
    if (requestPath !== HEALTH_PATH) {
      return Promise.resolve();
    }

    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    // Hocuspocus uses an empty rejection as a handled-response sentinel.
    // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
    return Promise.reject();
  },
});

server
  .listen()
  .then(() => {
    console.log(
      `Hocuspocus realtime server listening on ${server.webSocketURL}`,
    );
  })
  .catch((error) => {
    console.error("Failed to start realtime server:", error);
    process.exit(1);
  });
