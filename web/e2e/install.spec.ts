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

test("shows the snippet for this site, with its key and this dashboard's own address @smoke", async ({ page }) => {
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

  test("keeps the install guidance cards structurally aligned @regression @mobile", async ({ page, isMobile }) => {
    await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    const check = page.getByRole("heading", { name: /3\. Check it works/i }).locator("..");
    const naming = page.getByRole("heading", { name: /^Naming events/ }).locator("..");
    const checkBox = await check.boundingBox();
    const namingBox = await naming.boundingBox();
    expect(checkBox).not.toBeNull();
    expect(namingBox).not.toBeNull();
    if (isMobile) {
      expect(namingBox!.y).toBeGreaterThan(checkBox!.y + checkBox!.height);
    } else {
      expect(Math.abs(checkBox!.height - namingBox!.height)).toBeLessThanOrEqual(1);
    }
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

test("a public event reaches Install, Innings and Funnel while extra private data is refused @smoke", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await page.goto("/install");
    await expect(page.getByRole("status").filter({ hasText: "Waiting for the first event" })).toBeVisible();

    const anon = anonId();
    const refused = await page.request.post("/backend/v1/track", { data: { key: site.key, anon, name: "queue_joined", page: "/status/private-token" } });
    expect(refused.status()).toBe(400);
    for (const name of ["queue_joined", "called_in"]) {
      const accepted = await page.request.post("/backend/v1/track", { data: { key: site.key, anon, name } });
      expect(accepted.status()).toBe(204);
    }

    await expect(page.getByRole("status").filter({ hasText: "It works." })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("status")).toContainText("Called in");

    await page.goto("/innings");
    await expect(page.locator(".board .cell").filter({ hasText: "Active today" }).locator(".roll .sr-only")).toHaveText("1");

    await page.goto("/funnel");
    await expect(page.getByRole("heading", { name: /Queue joined to Called in/ })).toBeVisible();
    await expect(page.getByText(/^100% of the 1 person who started/)).toBeVisible();
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

test("the snippet shown here really works when pasted into another website", async ({ page }) => {
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

test("the page passes the accessibility scan and never scrolls sideways @mobile", async ({ page }) => {
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
