import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = 3420;
const API_PORT = 4000; // the dashboard is built to forward /backend/* to port 4000 (see next.config.ts)
const DB_PORT = 54349;
const base = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${WEB_PORT}`;
const local = !process.env.E2E_BASE_URL;

// Every test runs once in desktop Chrome: that is the complete browser regression.
// The 375 px phone repeats only critical journeys (@smoke) and checks whose evidence is genuinely
// viewport/touch-specific (@mobile). Edge repeats only the small critical smoke set. This keeps
// cross-browser confidence without multiplying content and server-behaviour tests that cannot vary by viewport.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: true,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL: base, trace: "retain-on-failure" },
  projects: [
    { name: "desktop-chrome", use: { ...devices["Desktop Chrome"], channel: "chrome" } },
    {
      name: "phone-375",
      use: { ...devices["Pixel 7"], channel: "chrome", viewport: { width: 375, height: 812 } },
      testIgnore: /\.desktop\.spec\.ts/,
      grep: /@mobile|@smoke/,
    },
    { name: "desktop-edge", use: { ...devices["Desktop Edge"], channel: "msedge" }, grep: /@smoke/ },
  ],
  // The whole stack runs on this computer: a real Postgres, the API, and the dashboard (a production
  // build, so run `npm run build` first). Point E2E_BASE_URL at a deployed site to test that instead.
  webServer: local
    ? [
        { command: "npx tsx scripts/e2e-db.ts", cwd: "../api", port: DB_PORT, reuseExistingServer: true, timeout: 240_000 },
        {
          command: "npx tsx src/server.ts",
          cwd: "../api",
          stdout: "pipe",
          stderr: "pipe",
          url: `http://127.0.0.1:${API_PORT}/health`,
          reuseExistingServer: true,
          timeout: 60_000,
          env: {
            PORT: String(API_PORT),
            NODE_ENV: "development",
            DATABASE_URL_APP: `postgres://pm_app:pm_app_local@127.0.0.1:${DB_PORT}/pulse`,
            DATABASE_URL_INGEST: `postgres://pm_ingest:pm_ingest_local@127.0.0.1:${DB_PORT}/pulse`,
            BETTER_AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e-secret",
            CRON_SECRET: "e2e-cron-secret-12345",
            WEB_ORIGIN: base,
          },
        },
        {
          command: `npx next start -p ${WEB_PORT}`,
          url: base,
          reuseExistingServer: true,
          timeout: 120_000,
          env: { API_URL: `http://127.0.0.1:${API_PORT}` },
        },
      ]
    : undefined,
});
