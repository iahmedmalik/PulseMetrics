import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signUpViaApi } from "./helpers";

// The A/B calculator: the numbers, and above all that it never claims a win it has not earned.

test.describe("A v B calculator", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
    await page.goto("/ab");
  });

  const fill = async (page: import("@playwright/test").Page, av: string, ac: string, bv: string, bc: string) => {
    await page.getByLabel("People who saw A").fill(av);
    await page.getByLabel("Did the thing").first().fill(ac);
    await page.getByLabel("People who saw B").fill(bv);
    await page.getByLabel("Did the thing").nth(1).fill(bc);
  };

  test("starts empty and asks for the numbers", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "A v B" })).toBeVisible();
    await expect(page.locator(".big")).toHaveText("p = –");
    await expect(page.getByRole("status")).toContainText("Enter the numbers.");
    // the fields look empty (no grey numbers that read as typed in); the examples fill them (#37)
    for (const input of await page.locator(".ab input").all()) {
      await expect(input).toHaveValue("");
      await expect(input).not.toHaveAttribute("placeholder", /.+/);
    }
    await expect(page.getByText("Try an example:")).toBeVisible();
  });

  test("10% v 12% with 1,000 each: p = 0.153 and it does NOT call B the winner @smoke", async ({ page }) => {
    await fill(page, "1000", "100", "1000", "120");
    await expect(page.locator(".big")).toHaveText("p = 0.153");
    await expect(page.getByRole("status")).toContainText("Not enough evidence yet.");
    await expect(page.getByRole("status")).not.toContainText("genuinely different");
    await expect(page.getByText("Version A converted 10.0%, version B 12.0%.")).toBeAttached();
    await expect(page.getByRole("status")).toContainText("not the chance that one version is better");
  });

  test("10% v 16% with 500 each: a real difference, and it says B", async ({ page }) => {
    await fill(page, "500", "50", "500", "80");
    await expect(page.locator(".big")).toHaveText("p = 0.005");
    await expect(page.getByRole("status")).toContainText("B is genuinely different.");
    await expect(page.getByRole("status")).toContainText("less than 1 time in 20");
  });

  test("says A when A is clearly ahead", async ({ page }) => {
    await fill(page, "500", "80", "500", "50");
    await expect(page.getByRole("status")).toContainText("A is genuinely different.");
  });

  test("a tiny sample is refused before p is trusted, even when the gap looks huge", async ({ page }) => {
    await fill(page, "10", "3", "10", "9");
    await expect(page.getByRole("status")).toContainText("Too few people to trust.");
    await expect(page.getByRole("status")).not.toContainText("genuinely different");
  });

  test("a very small p-value is shown as less than 0.001", async ({ page }) => {
    await fill(page, "1000", "100", "1000", "150");
    await expect(page.locator(".big")).toHaveText("p = < 0.001");
  });

  test("the examples fill the form in one click", async ({ page }) => {
    await page.getByRole("button", { name: "A clear difference" }).click();
    await expect(page.getByLabel("People who saw A")).toHaveValue("500");
    await expect(page.getByLabel("People who saw B")).toHaveValue("500");
    await expect(page.locator(".big")).toHaveText("p = 0.005");
    await page.getByRole("button", { name: "Could be luck" }).click();
    await expect(page.locator(".big")).toHaveText("p = 0.153");
    await page.getByRole("button", { name: "Too few people" }).click();
    await expect(page.getByRole("status")).toContainText("Too few people to trust.");
  });

test("more conversions than visitors blocks the result until corrected @regression", async ({ page }) => {
    await fill(page, "100", "250", "100", "20");
    await expect(page.getByText("That is more than the people who saw A. Reduce this count.")).toBeVisible();
    await expect(page.getByLabel("Did the thing").first()).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(".big")).toHaveText("p = –");
    await expect(page.locator(".bell")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("Fix the counts.");
    await page.getByLabel("Did the thing").first().fill("10");
    await expect(page.getByLabel("Did the thing").first()).toHaveAttribute("aria-invalid", "false");
    await expect(page.locator(".big")).not.toHaveText("p = –");
  });

  test("invalid whole-number counts are explained and never silently changed", async ({ page }) => {
    for (const input of ["abc", "-5", "1.5", "9007199254740992"]) {
      await fill(page, input, "100", "1000", "120");
      await expect(page.getByLabel("People who saw A")).toHaveAttribute("aria-invalid", "true");
      await expect(page.getByLabel("People who saw A")).toHaveValue(input);
      await expect(page.locator(".big")).toHaveText("p = –");
      await expect(page.getByRole("status")).toContainText("Fix the counts.");
      await expect(page.locator(".bell")).toHaveCount(0);
    }
    await fill(page, "1000", "100", "1000", "120");
    await expect(page.locator(".big")).toHaveText("p = 0.153");
  });

  test("blank counts stay incomplete instead of being treated as zero", async ({ page }) => {
    await fill(page, "1000", "", "1000", "120");
    await expect(page.locator(".big")).toHaveText("p = –");
    await expect(page.getByRole("status")).toContainText("Enter the numbers.");
    await expect(page.getByLabel("Did the thing").first()).toHaveAttribute("aria-invalid", "false");
  });

  test("shows the bell curve with the tails once there is a result, and explains how to read it", async ({ page }) => {
    await expect(page.locator(".bell")).toHaveCount(0);
    await fill(page, "1000", "100", "1000", "120");
    await expect(page.getByRole("img", { name: /bell curve/i })).toBeVisible();
    await expect(page.locator(".bell .tail")).toHaveCount(2);
    await expect(page.getByText("Decide how many people you need before you start")).toBeVisible();
  });

  test("with a result it passes the accessibility scan and never scrolls sideways @mobile", async ({ page }) => {
    await fill(page, "1000", "100", "1000", "120");
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
