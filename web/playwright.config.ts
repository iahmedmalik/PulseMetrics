import { defineConfig, devices } from "@playwright/test";

const PORT = 3420;
const base = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${PORT}`;

// Every test runs in desktop Chrome. Layout, touch and accessibility checks also run in a 375 px
// phone view, and the core flows (@core) also in desktop Edge (also Chromium, so only those).
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: base, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    {
      name: "phone-375",
      use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 375, height: 812 } },
      testIgnore: /\.desktop\.spec\.ts/,
    },
    { name: "desktop-edge", use: { ...devices["Desktop Edge"], channel: "msedge" }, grep: /@core/ },
  ],
  // Tests run against a production build: `npm run build` first.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : { command: `npx next start -p ${PORT}`, url: base, reuseExistingServer: true, timeout: 120_000 },
});
