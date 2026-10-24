import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { createSiteViaApi, signUpViaApi } from "./helpers";

// Ask your data. The test stack has no key for the question service, so these check the page's honest
// "not set up" state and its layout. Answering, limits and the guard rails are tested in the API tests with a
// scripted model, which costs nothing and never calls an AI service.

test.describe("ask", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

  test("with no site, the page says to make one", async ({ page }) => {
    await page.goto("/ask");
    await expect(page.getByText("Make a site first")).toBeVisible();
  });

  test("says plainly that asking is not set up, instead of showing a box that fails", async ({ page }) => {
    await createSiteViaApi(page, "QueueCare");
    await page.goto("/ask");
    await expect(page.getByRole("heading", { level: 1, name: "Ask" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Not set up yet" })).toBeVisible();
    await expect(page.getByText("no key for the question service")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ask", exact: true })).toHaveCount(0);
  });

test("the not-set-up page passes the accessibility scan and does not scroll sideways @mobile", async ({ page }) => {
    await createSiteViaApi(page, "QueueCare");
    await page.goto("/ask");
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
