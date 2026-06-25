import config from "@hibi/config/eslint";

export default [
  {
    ignores: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  ...config,
];
