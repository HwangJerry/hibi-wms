import config from "@hibi/config/eslint";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const tsconfigRootDir = dirname(fileURLToPath(import.meta.url));

export default [
  ...config,
  {
    ignores: ["src/generated/**"],
  },
  {
    files: ["prisma.config.ts", "prisma/**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
        project: "./tsconfig.eslint.json",
        tsconfigRootDir,
      },
    },
  },
];
