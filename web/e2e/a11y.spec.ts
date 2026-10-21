import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signUpViaApi } from "./helpers";

// One sweep over every screen, empty states included: WCAG 2.2 AA with axe, no sideways scrolling, a heading,
// and (on a phone) touch targets of at least 44 px. Pages with data have their own scans in their own specs.

const SIGNED_IN = ["/", "/innings", "/funnel", "/ab", "/install", "/ask", "/more"];
const PUBLIC = ["/sign-in", "/sign-up", "/privacy", "/how-its-built"];

async function check(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForTimeout(1500); // let the enter animations settle before measuring colour
  await expect(page.getByRole("heading", { level: 1 }).first(), `${path} has a heading`).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${path} scrolls sideways`).toBeLessThanOrEqual(0);

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`),
    `${path} accessibility`,
  ).toEqual([]);
}

test.describe("every screen", () => {
  test("signed-in screens pass the accessibility scan, with no site yet", async ({ page }) => {
    await signUpViaApi(page);
    for (const path of SIGNED_IN) await check(page, path);
  });

  test("public screens pass the accessibility scan, signed out", async ({ page }) => {
    for (const path of PUBLIC) await check(page, path);
  });

  test("on a phone, every button and link in the main area is a comfortable touch target", async ({ page, isMobile }) => {
    test.skip(!isMobile, "phone only");
    await signUpViaApi(page);
    for (const path of ["/", "/ab", "/install", "/more"]) {
      await page.goto(path);
      await page.waitForTimeout(1200);
      const small = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll<HTMLElement>("main button, main a.btn, main .tab-bar a, .tab-bar a, main input, main select")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue; // hidden
          if (r.height < 40 || r.width < 40) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
        return out;
      });
      expect(small, `${path} has small touch targets`).toEqual([]);
    }
  });

  test("a page that does not exist says so plainly", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist");
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/404|not found|could not be found/i).first()).toBeVisible();
  });
});
