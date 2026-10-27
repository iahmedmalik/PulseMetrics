import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { BASE, signUpViaApi } from "./helpers";

// The design shell: header with the pulse line, navigation, phone tab bar, motion and accessibility.

test.describe("the shell", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

  test("a slow page shows that it is loading, with the header still in place (#37) @mobile", async ({ page }) => {
    await page.goto("/");
    // hold back the page's own data (not the prefetch), as a slow or waking API would
    await page.route(/\/innings(\?|$)/, async (route) => {
      const h = route.request().headers();
      if (h["rsc"] && !h["next-router-prefetch"]) await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Innings" }).locator("visible=true").first().click();
    await expect(page.getByRole("status").filter({ hasText: "Fetching the numbers" })).toBeVisible();
    await expect(page.locator(".shell-header")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Innings" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Fetching the numbers")).toHaveCount(0);
  });

  test("shows the brand, the page heading and the navigation @smoke", async ({ page, isMobile }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "PulseMetrics" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Your sites" })).toBeVisible();
    if (isMobile) {
      const tabs = page.getByRole("navigation", { name: "Main" });
      await expect(tabs).toBeVisible();
      await expect(tabs.getByRole("link")).toHaveCount(5);
    } else {
      const nav = page.getByRole("navigation", { name: "Main" }).first();
      // Ask is marked "Soon" while it is switched off, as it is on the test stack (#37)
      for (const label of ["Sites", "Innings", "Funnel", "A v B", "Install", "Ask Soon"]) {
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

  test("New site opens and focuses the creation form from another page @smoke @regression", async ({ page }) => {
    await page.goto("/ab");
    const newSite = page.getByRole("link", { name: "New site", exact: true });
    // an outline button, so the page's own main action is the only amber one (#36)
    await expect(newSite).not.toHaveClass(/primary/);
    await newSite.click();
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

  test("uses the phone layout on a phone and the laptop layout on a laptop @mobile", async ({ page, isMobile }) => {
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

  test("never scrolls sideways @mobile", async ({ page }) => {
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("touch targets in the phone tab bar are at least 44 px @mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await page.goto("/");
    for (const link of await page.locator(".tab-bar a").all()) {
      const box = await link.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
      expect(box!.width).toBeGreaterThanOrEqual(44);
    }
  });

  test("passes the accessibility scan (WCAG 2.2 AA) @mobile", async ({ page }) => {
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
    const name = await page.locator(".content").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("enter");
  });

  test("decorative pulse rings are stroke-only instead of filled disks @regression", async ({ page }) => {
    await page.goto("/");
    const rings = page.locator(".art .ring");
    await expect(rings).toHaveCount(3);
    for (const ring of await rings.all()) {
      const style = await ring.evaluate((el) => ({ fill: getComputedStyle(el).fill, stroke: getComputedStyle(el).stroke }));
      expect(style.fill).toBe("none");
      expect(style.stroke).not.toBe("none");
    }
  });

  test("with reduced motion the page only fades, with no travel", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce", baseURL: BASE });
    const page = await context.newPage();
    await signUpViaApi(page);
    await page.goto("/");
    const name = await page.locator(".content").first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe("fade");
    const pulseRuns = await page.locator(".pulse-bg path:not(.base)").first().evaluate((el) => getComputedStyle(el).display);
    expect(pulseRuns).toBe("none");
    const ringStyle = await page.locator(".art .ring").first().evaluate((el) => ({ fill: getComputedStyle(el).fill, animation: getComputedStyle(el).animationName }));
    expect(ringStyle.fill).toBe("none");
    expect(ringStyle.animation).toBe("none");
    await context.close();
  });
});
