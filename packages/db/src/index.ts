import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadDotenv } from "dotenv";
import { PrismaClient } from "./generated/prisma/client.js";

export * from "./generated/prisma/client.js";
export type { PrismaClient } from "./generated/prisma/client.js";

const ENV_FILE_NAME = ".env";

function findNearestEnvFile() {
  let directory = dirname(fileURLToPath(import.meta.url));
  const rootDirectory = parse(directory).root;

  while (true) {
    const envFilePath = join(directory, ENV_FILE_NAME);
    if (existsSync(envFilePath)) {
      return envFilePath;
    }

    if (directory === rootDirectory) {
      return undefined;
    }

    directory = dirname(directory);
  }
}

function loadLocalEnv() {
  if (process.env.DATABASE_URL) {
    return;
  }

  const envFilePath = findNearestEnvFile();
  if (envFilePath) {
    loadDotenv({ path: envFilePath, quiet: true });
  }
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to initialize PrismaClient.");
  }

  return databaseUrl;
}

loadLocalEnv();

const adapter = new PrismaPg({ connectionString: getDatabaseUrl() });

export const prisma = new PrismaClient({ adapter });
