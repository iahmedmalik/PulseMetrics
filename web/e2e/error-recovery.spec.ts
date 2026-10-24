import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { createServer as createPortProbe } from "node:net";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { LOCAL_ONLY } from "./helpers";

// An isolated API stub exercises only page failure/retry, not authentication.
// Random loopback ports keep projects separate. No database is connected or seeded.
let api: Server;
let next: ChildProcess;
let base: string;
let failSites = true;
let siteRequests = 0;

async function unusedPort(): Promise<number> {
  const probe = createPortProbe();
  await new Promise<void>((done, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", done); });
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((done) => probe.close(() => done()));
  return port;
}

test.describe("page-data recovery", () => {
  test.skip(!LOCAL_ONLY, "uses an isolated local API stub, never a live deployment");
  test.beforeAll(async () => {
    api = createServer((req, res) => {
      res.setHeader("content-type", "application/json");
      if (req.url === "/v1/me") return res.end(JSON.stringify({ id: "recovery-fixture", name: "Recovery fixture", email: "recovery@example.com" }));
      if (req.url === "/v1/sites") {
        siteRequests++;
        res.statusCode = failSites ? 503 : 200;
        return res.end(JSON.stringify(failSites ? { error: "Temporarily unavailable." } : { sites: [] }));
      }
      res.statusCode = 404;
      res.end("{}");
    });
    await new Promise<void>((done, reject) => { api.once("error", reject); api.listen(0, "127.0.0.1", done); });
    const apiPort = (api.address() as { port: number }).port;
    const webPort = await unusedPort();
    base = `http://127.0.0.1:${webPort}`;
    next = spawn(process.execPath, [resolve(__dirname, "../../node_modules/next/dist/bin/next"), "start", "-p", String(webPort), "-H", "127.0.0.1"], {
      cwd: resolve(__dirname, ".."), windowsHide: true, stdio: "ignore",
      env: { ...process.env, API_URL: `http://127.0.0.1:${apiPort}` },
    });
    await expect.poll(async () => {
      if (next.exitCode !== null) throw new Error("Isolated Next server stopped before becoming ready.");
      try { return (await fetch(`${base}/privacy`, { signal: AbortSignal.timeout(2000) })).status; } catch { return 0; }
    }, { timeout: 60000, intervals: [500] }).toBe(200);
  });

  test.afterAll(async () => {
    if (next && next.exitCode === null && next.signalCode === null) {
      const stopped = new Promise<void>((done) => next.once("exit", () => done()));
      next.kill();
      await stopped;
    }
    if (api?.listening) await new Promise<void>((done) => api.close(() => done()));
  });

test("an unavailable report can be retried without losing the product shell @regression @mobile", async ({ page }, testInfo) => {
    await page.goto(base);
    await expect(page.getByRole("heading", { name: "Could not load this page", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "PulseMetrics", exact: true })).toBeVisible();
    await expect(page.locator("main")).not.toContainText(/ERROR \d+/);
    await page.screenshot({ path: testInfo.outputPath("unavailable.png"), fullPage: true });
    const before = siteRequests;
    failSites = false;
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your sites", exact: true })).toBeVisible();
    expect(siteRequests).toBeGreaterThan(before);
    await page.screenshot({ path: testInfo.outputPath("recovered.png"), fullPage: true });
  });
});
