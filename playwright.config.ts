import { defineConfig, devices } from "@playwright/test";
const previewPort = Number(process.env.TEST_PORT ?? 4173);
const testBasePath = process.env.TEST_BASE_PATH ?? "/";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: "list",
  use: {
    baseURL: `http://127.0.0.1:${previewPort}${testBasePath}`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "phone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "node scripts/preview-base.mjs",
    url: `http://127.0.0.1:${previewPort}${testBasePath}`,
    reuseExistingServer: !process.env.CI,
  },
});
