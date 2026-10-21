import AxeBuilder from "@axe-core/playwright";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { BASE, LOCAL_ONLY, anonId, createSiteViaApi, ingestDb, signUpViaApi } from "./helpers";

// The install page: the snippet for the current site, how to name events, and a check that it works.

test.describe("install", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

  test("with no site, the page says to make one", async ({ page }) => {
    await page.goto("/install");
    await expect(page.getByText("Make a site first")).toBeVisible();
  });

  test("shows the snippet for this site, with its key and this dashboard's own address", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    await expect(page.getByRole("heading", { level: 1, name: "Install" })).toBeVisible();
    const snippet = page.getByLabel("The snippet");
    await expect(snippet).toContainText(`<script src="${BASE}/p.js"`);
    await expect(snippet).toContainText(`data-key="${site.key}"`);
    await expect(snippet).toContainText("data-api=");
    await expect(snippet).toContainText("async");
    await expect(page.getByLabel("An event call")).toContainText('pulse.track("queue_joined");');
  });

  test("Copy puts the snippet on the clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const site = await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    await page.getByRole("button", { name: "Copy" }).first().click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain(`data-key="${site.key}"`);
  });

  test("the early-call helper opens and closes", async ({ page }) => {
    await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    const toggle = page.getByRole("button", { name: "Calling it before the page has loaded?" });
    await expect(page.getByLabel("The early-call helper")).toBeHidden();
    await toggle.click();
    await expect(page.getByLabel("The early-call helper")).toContainText("q:[]");
    await page.getByRole("button", { name: "Hide this" }).click();
    await expect(page.getByLabel("The early-call helper")).toBeHidden();
  });

  test("lists what is never stored and what is", async ({ page }) => {
    await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    const never = page.getByRole("list", { name: "Never stored" }).getByRole("listitem");
    await expect(never).toHaveText(["page address", "query string", "token", "name", "phone number", "email address", "health data", "IP address"]);
    await expect(page.getByRole("list", { name: "Stored", exact: true }).getByRole("listitem")).toHaveText(["event name", "random browser id", "time of the event"]);
    await expect(page.getByRole("link", { name: "privacy page" })).toHaveAttribute("href", "/privacy");
  });

  test("says it is waiting, then says it works the moment the first event arrives @core", async ({ page }) => {
    test.skip(!LOCAL_ONLY, "needs direct database access");
    const site = await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    await expect(page.getByRole("status").filter({ hasText: "Waiting for the first event" })).toBeVisible();
    const db = await ingestDb();
    try {
      await db.query("select record_event($1, $2, $3)", [site.key, anonId(), "queue_joined"]);
    } finally {
      await db.end();
    }
    await expect(page.getByRole("status").filter({ hasText: "It works." })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("status")).toContainText("Queue joined");
  });

  test("already says it works when events have arrived before", async ({ page }) => {
    test.skip(!LOCAL_ONLY, "needs direct database access");
    const site = await createSiteViaApi(page, "QueueCare");
    const db = await ingestDb();
    try {
      await db.query("select record_event($1, $2, $3)", [site.key, anonId(), "called_in"]);
    } finally {
      await db.end();
    }
    await page.goto("/install");
    await expect(page.getByRole("status").filter({ hasText: "It works." })).toBeVisible();
  });

  test("the snippet shown here really works when pasted into another website @core", async ({ page }) => {
    test.skip(!LOCAL_ONLY, "needs direct database access");
    const site = await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    const snippet = (await page.getByLabel("The snippet").textContent())!.trim();

    // "another website": a real little server whose page contains exactly the text from the Install page
    const server = createServer((_req, res) => {
      res.setHeader("content-type", "text/html");
      res.end(`<!doctype html><html><body><h1>My app</h1>${snippet}</body></html>`);
    });
    await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
    const origin = `http://localhost:${(server.address() as AddressInfo).port}`;
    try {
      const other = await page.context().newPage();
      await other.goto(origin);
      await other.waitForFunction(() => typeof (window as unknown as { pulse?: { track?: unknown } }).pulse?.track === "function");
      await other.evaluate(() => (window as unknown as { pulse: { track: (n: string) => void } }).pulse.track("queue_joined"));
      await other.close();
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }

    await page.reload();
    await expect(page.getByRole("status").filter({ hasText: "It works." })).toBeVisible({ timeout: 15_000 });
  });

  test("the page passes the accessibility scan and never scrolls sideways", async ({ page }) => {
    await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    await page.getByRole("button", { name: "Calling it before the page has loaded?" }).click();
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
