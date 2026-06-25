import baseConfig from "@hibi/config/eslint";

export default [
  {
    ignores: [
      ".ladle/**",
      "build/**",
      "postcss.config.cjs",
      "tailwind.config.ts",
    ],
  },
  ...baseConfig,
];
