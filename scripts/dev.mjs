import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { resolve } from "node:path";

const DEFAULT_API_PORT = 3000;
const DEFAULT_REALTIME_PORT = 3001;
const DEFAULT_POSTGRES_USER = "hibi";
const DEFAULT_POSTGRES_DB = "hibi_portal";
const DEFAULT_POSTGRES_PORT = "5432";
const DEV_PACKAGES = ["@hibi/api", "@hibi/realtime", "@hibi/web"];

function readLocalEnv() {
  const envPath = resolve(".env");
  if (!existsSync(envPath)) {
    return {};
  }

  const env = {};
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine.slice(0, separatorIndex).trim();
    const rawValue = trimmedLine.slice(separatorIndex + 1).trim();
    env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }

  return env;
}

function checkPortAvailable(port) {
  return new Promise((resolvePortCheck, rejectPortCheck) => {
    const server = createServer();

    server.once("error", (error) => {
      if ("code" in error && error.code === "EADDRINUSE") {
        resolvePortCheck(false);
        return;
      }

      rejectPortCheck(error);
    });

    server.once("listening", () => {
      server.close(() => resolvePortCheck(true));
    });

    server.listen(port, "0.0.0.0");
  });
}

async function findAvailablePort(startPort, reservedPorts) {
  let port = startPort;

  while (reservedPorts.has(port) || !(await checkPortAvailable(port))) {
    port += 1;
  }

  return port;
}

async function createDevEnv() {
  const localEnv = readLocalEnv();
  const env = {
    ...localEnv,
    ...process.env,
  };
  let useComposePostgres = false;

  env.POSTGRES_USER ??= DEFAULT_POSTGRES_USER;
  env.POSTGRES_DB ??= DEFAULT_POSTGRES_DB;
  env.POSTGRES_PORT ??= DEFAULT_POSTGRES_PORT;
  env.REALTIME_PORT ??= String(DEFAULT_REALTIME_PORT);
  env.SESSION_COOKIE_SECURE ??= "false";

  if (!env.DATABASE_URL && !env.POSTGRES_PASSWORD) {
    throw new Error(
      "DATABASE_URL or POSTGRES_PASSWORD is required. Set DATABASE_URL for an existing Postgres, or POSTGRES_PASSWORD for local Docker Compose Postgres.",
    );
  }

  if (!env.DATABASE_URL && env.POSTGRES_PASSWORD) {
    const password = encodeURIComponent(env.POSTGRES_PASSWORD);
    env.DATABASE_URL = `postgresql://${env.POSTGRES_USER}:${password}@127.0.0.1:${env.POSTGRES_PORT}/${env.POSTGRES_DB}?schema=public`;
    useComposePostgres = true;
  }

  const requestedApiPort = Number.parseInt(env.PORT ?? String(DEFAULT_API_PORT), 10);
  const realtimePort = Number.parseInt(env.REALTIME_PORT, 10);
  const reservedPorts = Number.isNaN(realtimePort) ? new Set() : new Set([realtimePort]);
  const shouldFindApiPort =
    Number.isNaN(requestedApiPort) ||
    reservedPorts.has(requestedApiPort) ||
    !(await checkPortAvailable(requestedApiPort));

  if (shouldFindApiPort) {
    const unavailableApiPort = Number.isNaN(requestedApiPort)
      ? DEFAULT_API_PORT
      : requestedApiPort;
    const apiPort = await findAvailablePort(
      unavailableApiPort,
      reservedPorts,
    );
    env.PORT = String(apiPort);
    env.API_PROXY_PORT = String(apiPort);

    if (apiPort !== unavailableApiPort) {
      console.log(`API port ${unavailableApiPort} is unavailable; using ${apiPort}.`);
    }
  } else {
    env.PORT = String(requestedApiPort);
    env.API_PROXY_PORT = String(requestedApiPort);
  }

  return { env, useComposePostgres };
}

function runCommand(command, args, env) {
  return new Promise((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      env,
      stdio: "inherit",
    });

    child.on("error", rejectCommand);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolveCommand();
        return;
      }

      rejectCommand(
        new Error(
          `${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}.`,
        ),
      );
    });
  });
}

const { env, useComposePostgres } = await createDevEnv();

if (useComposePostgres) {
  await runCommand("docker", ["compose", "up", "-d", "postgres"], env);
} else {
  console.log("Using DATABASE_URL from environment; skipping Docker Compose Postgres.");
}

await runCommand("pnpm", ["--filter", "@hibi/db", "db:generate"], env);
await runCommand("pnpm", ["build"], env);
await runCommand("pnpm", [
  "exec",
  "turbo",
  "run",
  "dev",
  "--parallel",
  ...DEV_PACKAGES.flatMap((pkg) => ["--filter", pkg]),
], env);
