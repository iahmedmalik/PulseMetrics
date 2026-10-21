import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCAL_ONLY, createSiteViaApi, seedJourneys, signUpViaApi } from "./helpers";

// The funnel page, with journeys of known size put into the database.

test.skip(!LOCAL_ONLY, "needs direct database access to put events in");

const STEPS = ["queue_joined", "status_viewed", "called_in"];

test.describe("funnel", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

  test("with fewer than two kinds of event it says what a funnel needs", async ({ page }) => {
    await createSiteViaApi(page, "Quiet app");
    await page.goto("/funnel");
    await expect(page.getByText(/A funnel needs at least two kinds of event, and Quiet app has sent none so far/)).toBeVisible();
    await expect(page.getByRole("link", { name: "See how to send events" })).toBeVisible();
  });

  test("shows people at each step, the biggest drop and the overall result @core", async ({ page, isMobile }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, STEPS, [40, 30, 20]);
    await page.goto("/funnel");

    await expect(page.getByRole("heading", { level: 1, name: "Funnel" })).toBeVisible();
    // the three steps were picked in the order they were first seen
    await expect(page.getByRole("combobox", { name: "Step 1" })).toHaveValue("queue_joined");
    await expect(page.getByRole("combobox", { name: "Step 2" })).toHaveValue("status_viewed");
    await expect(page.getByRole("combobox", { name: "Step 3" })).toHaveValue("called_in");

    if (isMobile) {
      // on a phone the same numbers are a list of bars; the wide drawing is hidden from everyone, screen readers included
      await expect(page.locator(".funnel-bars")).toContainText("Queue joined");
      await expect(page.locator(".funnel-bars li").nth(1)).toContainText("Status viewed");
      await expect(page.locator(".funnel-bars li").nth(1)).toContainText("30");
    } else {
      await expect(page.locator(".funnel-wide svg")).toHaveAttribute("aria-label", /Funnel: Queue joined 40, then Status viewed 30, then Called in 20/);
    }
    await expect(page.getByText("The biggest drop: between Queue joined and Status viewed.")).toBeVisible();
    await expect(page.getByText(/10 people \(25% of those who reached Queue joined\) did not go on/)).toBeVisible();
    await expect(page.getByText("50% of the 40 people who started got all the way to Called in.")).toBeVisible();
    await expect(page.getByText(/treat the percentages as a rough guide/)).toHaveCount(0); // 40 is enough
  });

  test("has a table with the same numbers", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, STEPS, [40, 30, 20]);
    await page.goto("/funnel");
    await expect(page.getByRole("table")).toBeHidden();
    await page.getByRole("button", { name: "Show as a table" }).click();
    const table = page.getByRole("table", { name: "People at each step of the funnel" });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row", { name: /1\. Queue joined\s+40\s+–\s+100%\s+–/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /2\. Status viewed\s+30\s+75%\s+75%\s+10/ })).toBeVisible();
    await expect(table.getByRole("row", { name: /3\. Called in\s+20\s+67%\s+50%\s+10/ })).toBeVisible();
  });

  test("warns when too few people started for the percentages to mean much", async ({ page }) => {
    const site = await createSiteViaApi(page, "Small app");
    await seedJourneys(site.id, STEPS, [10, 6, 3]);
    await page.goto("/funnel");
    await expect(page.getByText(/Only 10 people started here\. With so few, treat the percentages as a rough guide/)).toBeVisible();
  });

  test("uses the wide funnel on a laptop and a vertical list of bars on a phone", async ({ page, isMobile }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, STEPS, [40, 30, 20]);
    await page.goto("/funnel");
    if (isMobile) {
      await expect(page.locator(".funnel-narrow")).toBeVisible();
      await expect(page.locator(".funnel-wide")).toBeHidden();
      await expect(page.locator(".funnel-bars li")).toHaveCount(3);
      await expect(page.locator(".fb-left", { hasText: "−10 left (25%)" })).toBeVisible();
    } else {
      await expect(page.locator(".funnel-wide")).toBeVisible();
      await expect(page.locator(".funnel-narrow")).toBeHidden();
    }
  });

  test("the steps can be changed, added and removed, within 2 to 6 @core", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, [...STEPS, "step_out"], [40, 30, 20, 8]);
    await page.goto("/funnel");

    // 4 kinds of event exist, 3 are shown. Add the fourth.
    await page.getByRole("button", { name: "Add a step" }).click();
    await expect(page.getByRole("combobox", { name: "Step 4" })).toHaveValue("step_out");
    await expect(page.getByRole("button", { name: "Add a step" })).toHaveCount(0); // nothing left to add
    await page.getByRole("button", { name: "Show funnel" }).click();
    await expect(page).toHaveURL(/steps=queue_joined%2Cstatus_viewed%2Ccalled_in%2Cstep_out/);
    await expect(page.getByText("20% of the 40 people who started got all the way to Step out.")).toBeVisible();

    // remove two steps: the last two cannot be removed
    await page.getByRole("button", { name: "Remove step 4" }).click();
    await page.getByRole("button", { name: "Remove step 3" }).click();
    await expect(page.getByRole("button", { name: /Remove step/ })).toHaveCount(0);
    await page.getByRole("button", { name: "Show funnel" }).click();
    await expect(page.getByText("75% of the 40 people who started got all the way to Status viewed.")).toBeVisible();
  });

  test("the range tabs keep the chosen steps", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, [...STEPS, "step_out"], [40, 30, 20, 8]);
    await page.goto("/funnel?steps=status_viewed,called_in");
    await page.getByRole("link", { name: "30 days" }).click();
    await expect(page).toHaveURL(/steps=status_viewed%2Ccalled_in/);
    await expect(page).toHaveURL(/range=30/);
    await expect(page.getByRole("combobox", { name: "Step 1" })).toHaveValue("status_viewed");
  });

  test("steps in the address that are not event names fall back to the defaults, with no error page", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, STEPS, [40, 30, 20]);
    await page.goto("/funnel?steps=/m/abc123,ali@example.com");
    await expect(page.getByRole("heading", { level: 1, name: "Funnel" })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Step 1" })).toHaveValue("queue_joined");
  });

  test("a funnel nobody has started says so", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, STEPS, [40, 30, 20]);
    await page.goto("/funnel?steps=called_in,queue_joined"); // called_in comes first: nobody does queue_joined AFTER called_in
    await expect(page.getByRole("combobox", { name: "Step 1" })).toHaveValue("called_in");
    await expect(page.getByText("0% of the 20 people who started got all the way to Queue joined.")).toBeVisible();
  });

  test("passes the accessibility scan with the table open and never scrolls sideways", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await seedJourneys(site.id, STEPS, [40, 30, 20]);
    await page.goto("/funnel");
    await page.getByRole("button", { name: "Show as a table" }).click();
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
