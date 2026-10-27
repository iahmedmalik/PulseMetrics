import { expect, test, type Page } from "@playwright/test";
import { createSiteViaApi, signUpViaApi } from "./helpers";

// Motion is one vocabulary (DESIGN.md): every page change plays the page transition, headings flip in, and
// reduced motion keeps only fades. These checks record what the browser actually animated, not just the CSS.

type Seen = { calls: number; names: string[]; finishedAt: number; starts: { at: number; on: string; name: string }[] };

/** Wraps the browser's startViewTransition so the test can see each page change, what it animated, and
 *  every animation that starts afterwards (a page-level one starting then is the "blip" bug). */
async function recordTransitions(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __vt: Seen };
    w.__vt = { calls: 0, names: [], finishedAt: 0, starts: [] };
    document.addEventListener(
      "animationstart",
      (e) => {
        const el = e.target as Element;
        w.__vt.starts.push({ at: performance.now(), on: el.className.toString(), name: e.animationName });
      },
      true,
    );
    const original = document.startViewTransition.bind(document);
    document.startViewTransition = ((arg: Parameters<typeof original>[0]) => {
      const t = original(arg);
      w.__vt.calls += 1;
      t.finished.then(() => (w.__vt.finishedAt = performance.now())).catch(() => undefined);
      t.ready
        .then(() => {
          for (const a of document.getAnimations()) {
            const effect = a.effect as KeyframeEffect | null;
            if (effect?.pseudoElement?.startsWith("::view-transition")) {
              w.__vt.names.push(`${effect.pseudoElement} ${(a as CSSAnimation).animationName ?? ""}`);
            }
          }
        })
        .catch(() => undefined);
      return t;
    }) as typeof document.startViewTransition;
  });
}

const seen = (page: Page) => page.evaluate(() => (window as unknown as { __vt: Seen }).__vt);

async function goToAvB(page: Page) {
  await page.getByRole("link", { name: "A v B", exact: true }).locator("visible=true").first().click();
  await expect(page).toHaveURL(/\/ab$/);
  await expect(page.getByRole("heading", { level: 1, name: "A v B" })).toBeVisible();
}

test.describe("motion", () => {
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
    await createSiteViaApi(page, "Motion check");
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Your sites" })).toBeVisible();
  });

  test("moving between dashboard pages plays the page transition and keeps the header still @mobile @regression", async ({ page }) => {
    await recordTransitions(page);
    await goToAvB(page);
    await expect.poll(async () => (await seen(page)).names.length).toBeGreaterThan(0);
    const vt = await seen(page);
    expect(vt.calls).toBeGreaterThan(0);
    // the old page leaves and the new one fades and rises in
    expect(vt.names.some((n) => n.includes("view-transition-new") && n.endsWith("vt-rise"))).toBe(true);
    expect(vt.names.some((n) => n.includes("view-transition-old") && n.endsWith("vt-fade"))).toBe(true);
    // the header and tab bar are pinned: nothing animates them
    expect(vt.names.filter((n) => n.includes("pm-header") || n.includes("pm-tabbar"))).toEqual([]);
  });

  test("after a page change has finished, the page does not fade in a second time @mobile @regression", async ({ page }) => {
    await recordTransitions(page);
    await goToAvB(page);
    await expect.poll(async () => (await seen(page)).finishedAt).toBeGreaterThan(0);
    await page.waitForTimeout(1200); // longer than any entrance, so a late restart would be caught
    const vt = await seen(page);
    const late = vt.starts.filter((s) => s.at >= vt.finishedAt && /(^|\s)(page|content)(\s|$)/.test(s.on));
    expect(late).toEqual([]);
  });

  test("the page heading flips in word by word and is read once @mobile @regression", async ({ page }) => {
    await goToAvB(page);
    const words = page.locator("h1.flip .fw");
    await expect(words).toHaveCount(3);
    const names = await words.evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(names).toEqual(["flip-in", "flip-in", "flip-in"]);
    const delays = await words.evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).animationDelay)));
    expect(delays[1]).toBeGreaterThan(delays[0]!);
    // screen readers get the plain heading once, not the animated copy
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("A v B");
  });

  test("with reduced motion, page changes and headings only fade @mobile @regression", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await recordTransitions(page);
    await goToAvB(page);
    await expect.poll(async () => (await seen(page)).names.length).toBeGreaterThan(0);
    const vt = await seen(page);
    expect(vt.names.some((n) => n.endsWith("vt-rise"))).toBe(false);
    expect(vt.names.some((n) => n.endsWith("vt-fade"))).toBe(true);
    const names = await page.locator("h1.flip .fw").evaluateAll((els) => els.map((el) => getComputedStyle(el).animationName));
    expect(new Set(names)).toEqual(new Set(["fade"]));
  });
});
