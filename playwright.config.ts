import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const E2E_HOST = "127.0.0.1";
const E2E_WEB_PORT = 5173;
const APP_URL = `http://${E2E_HOST}:${E2E_WEB_PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: APP_URL,
    trace: "on-first-retry",
    video: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "pnpm dev",
    url: APP_URL,
    timeout: 240_000,
    reuseExistingServer: false,
    env: {
      ...process.env,
    },
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
});
