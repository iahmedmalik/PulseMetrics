import AxeBuilder from "@axe-core/playwright";
import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { signUpViaApi } from "./helpers";

// The "How it's built" page: public, honest, and free of wording the project's rules forbid.

test.describe("how it's built", () => {
test("anyone can open it, and it has every section", async ({ page }) => {
    await page.goto("/how-its-built");
    await expect(page.getByRole("heading", { level: 1, name: "How it's built" })).toBeVisible();
    for (const h of ["Who built it", "The story", "The problem", "The technology", "Architecture", "Decisions worth knowing", "Tests", "Honest limits", "Links", "Credits"]) {
      await expect(page.getByRole("heading", { level: 2, name: h })).toBeVisible();
    }
  });

  test("draws the architecture and describes it in words", async ({ page }) => {
    await page.goto("/how-its-built");
    await expect(page.getByRole("img", { name: /Architecture: a snippet in your app sends events to the API/ })).toBeVisible();
  });

  test("shows real test numbers and the stack", async ({ page }) => {
    await page.goto("/how-its-built");
    const tests = page.locator(".counts");
    await expect(tests).toContainText("unit tests");
    await expect(tests).toContainText("API and database tests");
    await expect(tests).toContainText("browser test runs");
    for (const n of await tests.locator(".big-n").allTextContents()) expect(Number(n)).toBeGreaterThan(0);
    for (const item of ["Next.js 16", "Express 5", "Better Auth", "Postgres on Neon", "Playwright"]) {
      await expect(page.getByRole("listitem").filter({ hasText: item }).first()).toBeVisible();
    }
  });

test("links to the repository, README, PRD and test report @regression", async ({ page }) => {
    await page.goto("/how-its-built");
    const hrefs = await page.getByRole("list").filter({ has: page.getByRole("link", { name: "Source code on GitHub" }) }).getByRole("link").evaluateAll((a) => a.map((x) => (x as HTMLAnchorElement).href));
    expect(hrefs).toEqual(
      expect.arrayContaining([
        "https://github.com/ahmed-malikk/PulseMetrics",
        "https://github.com/ahmed-malikk/PulseMetrics#readme",
        "https://github.com/ahmed-malikk/PulseMetrics/blob/main/docs/PRD.md",
        "https://github.com/ahmed-malikk/PulseMetrics/blob/main/docs/TEST-REPORT.md",
      ]),
    );
    // Windows resolves paths without checking case; GitHub requires the exact tracked spelling.
    for (const href of hrefs) {
      const prefix = "https://github.com/ahmed-malikk/PulseMetrics/blob/main/";
      if (!href.startsWith(prefix)) continue;
      let directory = resolve(__dirname, "../..");
      for (const segment of href.slice(prefix.length).split("/")) {
        expect(await readdir(directory), `${href} uses the actual filename case`).toContain(segment);
        directory = join(directory, segment);
      }
    }
  });

  test("never mentions inspiration or how it was written, and keeps no portfolio wording on the product screens", async ({ page }) => {
    await page.goto("/how-its-built");
    const text = (await page.locator("main").innerText()).replace(/\s+/g, " ");
    expect(text).not.toMatch(/inspir/i);
    expect(text).not.toMatch(/\bAI\b|claude|chatgpt|copilot|generated/i);
    // the main product screens read as a real product
    await signUpViaApi(page);
    await page.goto("/");
    expect((await page.locator("main").innerText()).toLowerCase()).not.toContain("portfolio");
  });

test("a signed-in owner keeps the full navigation around it @mobile", async ({ page, isMobile }) => {
    await signUpViaApi(page);
    await page.goto("/how-its-built");
    await expect(page.getByRole("heading", { level: 1, name: "How it's built" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).first()).toBeVisible();
    if (!isMobile) await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  });

  test("is reachable from the top bar", async ({ page, isMobile }) => {
    test.skip(isMobile, "the top bar link is for laptops; phones use More");
    await signUpViaApi(page);
    await page.goto("/");
    await page.getByRole("link", { name: "How it's built" }).click();
    await expect(page).toHaveURL(/\/how-its-built$/);
  });

test("passes the accessibility scan and never scrolls sideways @mobile", async ({ page }) => {
    await page.goto("/how-its-built");
    await page.waitForTimeout(2000);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
