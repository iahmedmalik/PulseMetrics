import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signUpViaApi } from "./helpers";

// The privacy page: public, plain, and checked against what the product really does.

test.describe("privacy", () => {
  test("anyone can read it without signing in @core", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: "Privacy" })).toBeVisible();
    await expect(page.getByText("Last updated 21 October 2026")).toBeVisible();
  });

  test("says what is stored, what is never collected, how long, and how to delete", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.getByRole("list", { name: "Never stored" }).getByRole("listitem")).toHaveCount(8);
    await expect(page.getByRole("list", { name: "Stored", exact: true }).getByRole("listitem")).toHaveCount(3);
    await expect(page.getByText(/older than 180 days/)).toBeVisible();
    await expect(page.getByText(/200,000 events/)).toBeVisible();
    await expect(page.getByText(/Do Not Track, or Global Privacy Control, is not tracked at all/)).toBeVisible();
    await expect(page.getByText(/delete a site at any time/)).toBeVisible();
    await expect(page.getByText(/not in a cookie/)).toBeVisible();
    await expect(page.getByText(/sets no cookie on visitors/)).toBeVisible();
  });

  test("is linked from the footer on every kind of page", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Privacy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);

    await signUpViaApi(page);
    await page.goto("/");
    await page.getByRole("contentinfo").getByRole("link", { name: "Privacy" }).or(page.locator(".foot").getByRole("link", { name: "Privacy" })).first().click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test("passes the accessibility scan and never scrolls sideways", async ({ page }) => {
    await page.goto("/privacy");
    await page.waitForTimeout(1800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
