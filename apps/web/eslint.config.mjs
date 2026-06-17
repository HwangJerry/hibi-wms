import config from "@hibi/config/eslint";

export default [
  {
    ignores: ["dist/**", "postcss.config.js"],
  },
  ...config,
];
