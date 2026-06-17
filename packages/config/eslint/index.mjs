import js from "@eslint/js";
import process from "node:process";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "node_modules/**",
      "pnpm-lock.yaml",
      "eslint.config.mjs",
      "prettier.config.mjs"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: process.cwd()
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { "fixStyle": "inline-type-imports" }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }
      ]
    }
  }
];
