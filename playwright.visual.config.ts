import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const VISUAL_HOST = "127.0.0.1";
const VISUAL_WEB_PORT = 5173;
const APP_URL = `http://${VISUAL_HOST}:${VISUAL_WEB_PORT}`;

export default defineConfig({
  testDir: "./tests/visual",
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  workers: 1,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: APP_URL,
    locale: "en-US",
    timezoneId: "Asia/Seoul",
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
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-mobile",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
