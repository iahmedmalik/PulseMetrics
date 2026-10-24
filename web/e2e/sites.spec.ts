import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCAL_ONLY, anonId, createSiteViaApi, ingestDb, ownerDb, signUpViaApi } from "./helpers";

// Sites: make one, copy its snippet, read and replace its key.

test.describe("sites", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

test("an owner with no sites is invited to make the first one", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Make your first site" })).toBeVisible();
    await page.getByLabel("Name it").fill("QueueCare");
    await page.getByRole("button", { name: "Create site" }).click();

    const card = page.getByRole("article", { name: "QueueCare" });
    await expect(card).toBeVisible();
    await expect(card.getByText(/key [0-9a-f]{4}…[0-9a-f]{4} · 0 events/)).toBeVisible();
    // the steps strip moves on: the site exists, now the snippet is the next thing to do
    await expect(page.locator(".step.done")).toHaveCount(1);
    await expect(page.getByText("Waiting for QueueCare")).toBeVisible();
    // and the form now offers another site
    await expect(page.getByRole("heading", { name: "Add a site" })).toBeVisible();
  });

  test("a name is required, with a plain message", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Create site" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("Give the site a name.");
  });

  test("Copy snippet puts the script tag, with the site key, on the clipboard", async ({ page, context, browserName }) => {
    test.skip(browserName !== "chromium", "clipboard permissions are Chromium-only");
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const site = await createSiteViaApi(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Copy snippet" }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toContain("<script src=");
    expect(text).toContain("/p.js");
    expect(text).toContain(`data-key="${site.key}"`);
    expect(text).toContain("async");
  });

  test("the key panel shows the full key and can be opened and closed", async ({ page }) => {
    const site = await createSiteViaApi(page);
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Key", exact: true });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(site.key)).toBeVisible();
    await toggle.click();
    await expect(page.getByText(site.key)).toBeHidden();
  });

test("replacing the key asks first, then the old key stops working and the new one works", async ({ page }) => {
    test.skip(!LOCAL_ONLY, "needs direct database access");
    const site = await createSiteViaApi(page);
    await page.goto("/");
    await page.getByRole("button", { name: "Key", exact: true }).click();

    await page.getByRole("button", { name: "Replace key" }).click();
    await expect(page.getByText("The snippet already on your site stops working at once")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByText(site.key)).toBeVisible(); // cancelled: nothing changed

    await page.getByRole("button", { name: "Replace key" }).click();
    await page.getByRole("button", { name: "Yes, replace it" }).click();
    await expect(page.getByText(site.key)).toBeHidden();
    const newKey = (await page.locator(".key-full").textContent())!.trim();
    expect(newKey).toMatch(/^[0-9a-f]{24}$/);
    expect(newKey).not.toBe(site.key);

    const db = await ingestDb();
    try {
      const old = await db.query("select record_event($1, $2, $3) as r", [site.key, anonId(), "queue_joined"]);
      expect(old.rows[0].r).toBe("unknown_key");
      const fresh = await db.query("select record_event($1, $2, $3) as r", [newKey, anonId(), "queue_joined"]);
      expect(fresh.rows[0].r).toBe("ok");
    } finally {
      await db.end();
    }
  });

  test("a site shows live events once they arrive", async ({ page }) => {
    test.skip(!LOCAL_ONLY, "needs direct database access");
    const site = await createSiteViaApi(page, "Busy app");
    const db = await ingestDb();
    try {
      await db.query("select record_event($1, $2, $3)", [site.key, anonId(), "queue_joined"]);
    } finally {
      await db.end();
    }
    await page.goto("/");
    const card = page.getByRole("article", { name: "Busy app" });
    await expect(card.getByText("live today")).toBeVisible();
    await expect(card.getByText(/· 1 event$/)).toBeVisible();
    await expect(page.locator(".step.done")).toHaveCount(3);
  });

test("deleting a site asks first, then removes it and every event", async ({ page }) => {
    test.skip(!LOCAL_ONLY, "needs direct database access");
    const site = await createSiteViaApi(page, "Doomed app");
    const ingest = await ingestDb();
    try {
      for (let i = 0; i < 3; i++) await ingest.query("select record_event($1, $2, $3)", [site.key, anonId(), "queue_joined"]);
    } finally {
      await ingest.end();
    }
    await page.goto("/");
    const card = page.getByRole("article", { name: "Doomed app" });
    await card.getByRole("button", { name: "Key", exact: true }).click();

    await card.getByRole("button", { name: "Delete site" }).click();
    await expect(card.getByText(/Delete Doomed app and all 3 of its events for good\? This cannot be undone\./)).toBeVisible();
    await card.getByRole("button", { name: "Keep it" }).click();
    await expect(card).toBeVisible(); // nothing happened

    await card.getByRole("button", { name: "Delete site" }).click();
    await card.getByRole("button", { name: "Yes, delete it" }).click();
    await expect(page.getByRole("article", { name: "Doomed app" })).toHaveCount(0);

    const db = await ownerDb();
    try {
      expect(Number((await db.query("select count(*) as n from events where site_id = $1", [site.id])).rows[0].n)).toBe(0);
      expect((await db.query("select 1 from sites where id = $1", [site.id])).rows).toHaveLength(0);
    } finally {
      await db.end();
    }
  });

  test("owners never see each other's sites", async ({ browser, baseURL }) => {
    const a = await browser.newContext({ baseURL });
    const b = await browser.newContext({ baseURL });
    const pageA = await a.newPage();
    const pageB = await b.newPage();
    await signUpViaApi(pageA);
    await signUpViaApi(pageB);
    await createSiteViaApi(pageA, "Alice's private app");
    await pageB.goto("/");
    await expect(pageB.getByText("Alice's private app")).toHaveCount(0);
    await pageA.goto("/");
    await expect(pageA.getByRole("article", { name: "Alice's private app" })).toBeVisible();
    await a.close();
    await b.close();
  });

test("the sites page with a site passes the accessibility scan and never scrolls sideways @mobile", async ({ page }) => {
    await createSiteViaApi(page, "QueueCare");
    await page.goto("/");
    await page.getByRole("button", { name: "Key", exact: true }).click();
    await page.waitForTimeout(1100);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
