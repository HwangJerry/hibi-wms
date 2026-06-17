import { fastifyTRPCPlugin } from "@trpc/server/adapters/fastify";
import Fastify from "fastify";
import { createContext } from "./context.js";
import { appRouter } from "./routers/index.js";

const DEFAULT_HOST = "0.0.0.0";
const DEFAULT_PORT = 3000;
const TRPC_PREFIX = "/trpc";

function getPort() {
  const rawPort = process.env.PORT;
  if (!rawPort) {
    return DEFAULT_PORT;
  }

  const port = Number.parseInt(rawPort, 10);
  if (Number.isNaN(port)) {
    throw new Error("PORT must be a valid number.");
  }

  return port;
}

export function createServer() {
  const server = Fastify({
    logger: true,
  });

  server.get("/health", () => ({
    status: "ok" as const,
  }));

  void server.register(fastifyTRPCPlugin, {
    prefix: TRPC_PREFIX,
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  return server;
}

export async function startServer() {
  const server = createServer();
  const port = getPort();

  await server.listen({
    host: process.env.HOST ?? DEFAULT_HOST,
    port,
  });

  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await startServer();
}
