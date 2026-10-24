import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { BASE, signUpViaApi } from "./helpers";

// The design shell: header with the pulse line, navigation, phone tab bar, motion and accessibility.

test.describe("the shell", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

  test("shows the brand, the page heading and the navigation @core", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "PulseMetrics" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Your sites" })).toBeVisible();
    if (isMobile) {
      const tabs = page.getByRole("navigation", { name: "Main" });
      await expect(tabs).toBeVisible();
      await expect(tabs.getByRole("link")).toHaveCount(5);
    } else {
      const nav = page.getByRole("navigation", { name: "Main" }).first();
      for (const label of ["Sites", "Innings", "Funnel", "A v B", "Install", "Ask"]) {
        await expect(nav.getByRole("link", { name: label, exact: true })).toBeVisible();
      }
    }
  });

  test("marks the current page in the navigation", async ({ page, isMobile }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    const current = isMobile ? nav.getByRole("link", { name: "Sites" }) : nav.first().getByRole("link", { name: "Sites", exact: true });
    await expect(current).toHaveAttribute("aria-current", "page");
  });

  test("New site opens and focuses the creation form from another page @core", async ({ page }) => {
    await page.goto("/ab");
    await page.getByRole("link", { name: "New site", exact: true }).click();
    await expect(page).toHaveURL(/\/#new-site-name$/);
    const name = page.getByRole("textbox", { name: "Name it" });
    await expect(name).toBeFocused();
    await expect(name).toBeInViewport();
    const header = await page.locator(".shell-header").boundingBox();
    const field = await name.boundingBox();
    expect(field!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    await name.fill("New site action check");
    await page.getByRole("button", { name: "Create site", exact: true }).click();
    await expect(page.getByRole("article", { name: "New site action check", exact: true })).toBeVisible();
  });

  test("uses the phone layout on a phone and the laptop layout on a laptop", async ({ page, isMobile }) => {
    await page.goto("/");
    const tabBar = page.locator(".tab-bar");
    const mainNav = page.locator(".main-nav");
    if (isMobile) {
      await expect(tabBar).toBeVisible();
      await expect(mainNav).toBeHidden();
    } else {
      await expect(tabBar).toBeHidden();
      await expect(mainNav).toBeVisible();
    }
  });

  test("never scrolls sideways", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("touch targets in the phone tab bar are at least 44 px", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await page.goto("/");
    for (const link of await page.locator(".tab-bar a").all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("passes the accessibility scan (WCAG 2.2 AA)", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(900); // let the enter animation settle before measuring contrast
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});

test.describe("motion", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

  test("the page rises in with the shared enter animation", async ({ page }) => {
    await page.goto("/");
    const name = await page.locator(".page").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("enter");
  });

  test("with reduced motion the page only fades, with no travel", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", baseURL: BASE });
    const page = await context.newPage();
    await signUpViaApi(page);
    await page.goto("/");
    const name = await page.locator(".page").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("fade");
    const pulseRuns = await page.locator(".pulse-bg path:not(.base)").first().evaluate((el) => getComputedStyle(el).display);
    expect(pulseRuns).toBe("none");
    await context.close();
  });
});
