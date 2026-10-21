import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PASSWORD, signUpViaApi, uniqueEmail } from "./helpers";

// Sign-up, sign-in and sign-out through the real screens, against the real API and database.

test.describe("signing in", () => {
  test("a signed-out visitor is sent to the sign-in page @core", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  });

  test("a new owner creates an account and lands on their sites @core", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("Ali Raza");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "Your sites" })).toBeVisible();
  });

  test("an existing owner signs in and out @core", async ({ page, context }) => {
    const { email } = await signUpViaApi(page);
    await context.clearCookies();

    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Your sites" })).toBeVisible();

    // Sign out is in the header on a laptop and on the More page on a phone.
    const signOut = page.getByRole("button", { name: "Sign out" });
    if (await signOut.isVisible()) {
      await signOut.click();
    } else {
      await page.goto("/more");
      await page.getByRole("button", { name: "Sign out" }).click();
    }
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("the wrong password gets a plain message and no session", async ({ page }) => {
    const { email } = await signUpViaApi(page);
    await page.context().clearCookies();
    await page.goto("/sign-in");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("not-the-right-password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("That email and password don't match");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a short password is explained before anything is sent", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("Short Pass");
    await page.getByLabel("Email").fill(uniqueEmail());
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("at least 10 characters");
  });

  test("an email that already has an account is told to sign in instead", async ({ page, context }) => {
    const { email } = await signUpViaApi(page);
    await context.clearCookies();
    await page.goto("/sign-up");
    await page.getByLabel("Your name").fill("Twice");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.locator("main").getByRole("alert")).toContainText("already an account");
  });

  test("the sign-in and sign-up pages never scroll sideways and pass the accessibility scan", async ({ page }) => {
    for (const path of ["/sign-in", "/sign-up"]) {
      await page.goto(path);
      await page.waitForTimeout(900);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, path).toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`), path).toEqual([]);
    }
  });
});
