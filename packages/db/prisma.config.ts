import { existsSync } from "node:fs";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

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

function getDatabaseUrl() {
  if (!process.env.DATABASE_URL) {
    const envFilePath = findNearestEnvFile();
    if (envFilePath) {
      loadDotenv({ path: envFilePath, quiet: true });
    }
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for Prisma commands.");
  }

  return databaseUrl;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: getDatabaseUrl(),
  },
});
