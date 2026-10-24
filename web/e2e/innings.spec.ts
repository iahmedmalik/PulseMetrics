import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LOCAL_ONLY, anonId, createSiteViaApi, ingestDb, ownerDb, signUpViaApi } from "./helpers";

// Innings: the scoreboard and the daily active browsers chart, with events put in on known days.

test.skip(!LOCAL_ONLY, "needs direct database access to put events on known days");

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Today's date in Pakistan, as the server counts days. */
function pakistanToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}
function daysAgo(n: number): string {
  const d = new Date(`${pakistanToday()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
const label = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}`;
};

/** Puts `browsers` different browsers' events on the day that was `ago` days before today (at noon in Pakistan). */
async function addDay(siteId: string, ago: number, browsers: number) {
  const db = await ownerDb();
  try {
    const at = `${daysAgo(ago)}T07:00:00Z`;
    for (let i = 0; i < browsers; i++) {
      await db.query("insert into events (site_id, anon_id, name, created_at) values ($1, $2, 'queue_joined', $3)", [siteId, anonId(), at]);
      await db.query("update sites set event_count = event_count + 1 where id = $1", [siteId]);
    }
  } finally {
    await db.end();
  }
}

const cellValue = (page: Page, title: string) => page.locator(".cell", { hasText: title }).locator(".roll .sr-only");

test.describe("innings", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
  });

test("with no site, the page says to make one", async ({ page }) => {
    await page.goto("/innings");
    await expect(page.getByText("Make a site first")).toBeVisible();
    await page.getByRole("link", { name: "Make a site" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("a site with no events says nothing has arrived and points to the snippet", async ({ page }) => {
    await createSiteViaApi(page, "Quiet app");
    await page.goto("/innings");
    await expect(page.getByRole("heading", { level: 1, name: "Quiet app" })).toBeVisible();
    await expect(page.getByText("Nothing has arrived yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Install the snippet" })).toBeVisible();
    await expect(cellValue(page, "Active today")).toHaveText("0");
    await expect(page.locator(".bar")).toHaveCount(13); // only the heading drawing, no chart
  });

test("shows today, the busiest day and the average from real events", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await addDay(site.id, 0, 2); // today: 2 browsers
    await addDay(site.id, 1, 5); // yesterday: 5
    await addDay(site.id, 3, 3); // 3 days ago: 3
    await page.goto("/innings");

    await expect(cellValue(page, "Active today")).toHaveText("2");
    await expect(cellValue(page, "Busiest day")).toHaveText("5");
    await expect(page.locator(".cell", { hasText: "Busiest day" })).toContainText(label(daysAgo(1)));
    // completed days in a 14 day range are 13; (5 + 3) / 13 = 0.6, which rounds to 1
    await expect(cellValue(page, "Daily average")).toHaveText("1");
    await expect(cellValue(page, "Events, all time")).toHaveText("10");
    await expect(page.getByText(`Busiest day: ${label(daysAgo(1))}, with 5 browsers. So far today: 2.`)).toBeVisible();
  });

  test("draws one bar per day, with today dashed, and a table with the same numbers", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await addDay(site.id, 0, 2);
    await addDay(site.id, 1, 5);
    await page.goto("/innings");

    const chart = page.locator(".paper");
    await expect(chart.locator(".bar")).toHaveCount(14);
    await expect(chart.locator(".bar.part")).toHaveCount(1);
    await expect(chart.getByRole("img")).toHaveAttribute("aria-label", /Active browsers per day for QueueCare, 14 days/);

    const toggle = page.getByRole("button", { name: "Show as a table" });
    await expect(page.getByRole("table")).toBeHidden();
    await toggle.click();
    const table = page.getByRole("table", { name: "Active browsers per day for QueueCare" });
    await expect(table).toBeVisible();
    await expect(table.locator("tbody tr")).toHaveCount(14);
    await expect(table.getByRole("row", { name: new RegExp(`${label(daysAgo(1))}\\s+5`) })).toBeVisible();
    await expect(table.getByRole("row", { name: new RegExp(`${label(daysAgo(0))} \\(so far\\)\\s+2`) })).toBeVisible();
    await page.getByRole("button", { name: "Hide the table" }).click();
    await expect(page.getByRole("table")).toBeHidden();
  });

  test("the range tabs switch between 7, 14 and 30 days and the choice is in the address", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await addDay(site.id, 1, 3);
    await page.goto("/innings");
    for (const [name, count] of [["7 days", 7], ["30 days", 30], ["14 days", 14]] as const) {
      await page.getByRole("link", { name }).click();
      await expect(page).toHaveURL(new RegExp(`range=${count}$`));
      await expect(page.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
      await expect(page.locator(".paper .bar")).toHaveCount(count);
    }
    await page.goto("/innings?range=nonsense");
    await expect(page.locator(".paper .bar")).toHaveCount(14); // an unknown range falls back to 14
  });

  test("hovering a bar shows its day and number", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover is for pointers");
    const site = await createSiteViaApi(page, "QueueCare");
    await addDay(site.id, 1, 4);
    await page.goto("/innings");
    const bars = page.locator(".paper .bar");
    await expect(bars).toHaveCount(14);
    await page.waitForTimeout(1500); // let the bars finish growing before pointing at one
    await bars.nth(12).scrollIntoViewIfNeeded();
    await bars.nth(12).hover(); // yesterday is the second last of 14
    await expect(page.getByText(`${label(daysAgo(1))}: 4 browsers`)).toBeVisible();
  });

  test("says nothing has arrived in the live list when there are no events", async ({ page }) => {
    await createSiteViaApi(page, "Quiet app");
    await page.goto("/innings");
    await expect(page.getByText("Nothing yet. The first event appears here within a few seconds of arriving.")).toBeVisible();
  });

test("a new event shows in the live list within seconds, without reloading", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    const db = await ingestDb();
    try {
      await db.query("select record_event($1, $2, $3)", [site.key, anonId(), "queue_joined"]);
      await page.goto("/innings");
      const list = page.getByRole("list", { name: "Latest events" });
      await expect(list.getByText("queue_joined")).toBeVisible();
      await expect(list.getByRole("listitem")).toHaveCount(1);

      // an event arrives while the page is open
      await db.query("select record_event($1, $2, $3)", [site.key, anonId(), "status_viewed"]);
      await expect(list.getByText("status_viewed")).toBeVisible({ timeout: 15_000 });
      await expect(list.getByRole("listitem")).toHaveCount(2);
      await expect(list.getByRole("listitem").first()).toContainText("status_viewed"); // newest first
    } finally {
      await db.end();
    }
  });

  test("the live list shows fixed event names and only 4 characters of a browser id", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    const db = await ingestDb();
    const anon = anonId();
    try {
      await db.query("select record_event($1, $2, $3)", [site.key, anon, "queue_joined"]);
    } finally {
      await db.end();
    }
    await page.goto("/innings");
    const item = page.getByRole("list", { name: "Latest events" }).getByRole("listitem").first();
    await expect(item).toContainText(`browser ${anon.slice(0, 4)}…`);
    await expect(item).toContainText("just now");
    expect(await item.textContent()).not.toContain(anon);
  });

  test("with two sites a switcher picks which one is shown, and remembers it", async ({ page }) => {
    await createSiteViaApi(page, "First site");
    await createSiteViaApi(page, "Second site");
    await page.goto("/innings");
    await expect(page.getByRole("heading", { level: 1, name: "First site" })).toBeVisible();
    await page.getByRole("combobox", { name: "Site" }).selectOption({ label: "Second site" });
    await expect(page.getByRole("heading", { level: 1, name: "Second site" })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Second site" })).toBeVisible();
  });

test("the page with data passes the accessibility scan and never scrolls sideways @mobile", async ({ page }) => {
    const site = await createSiteViaApi(page, "QueueCare");
    await addDay(site.id, 0, 2);
    await addDay(site.id, 2, 6);
    await page.goto("/innings");
    await page.getByRole("button", { name: "Show as a table" }).click();
    await page.waitForTimeout(1500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  });
});
