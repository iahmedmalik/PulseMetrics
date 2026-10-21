import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test, type Page } from "@playwright/test";
import { BASE, LOCAL_ONLY, createSiteViaApi, ownerDb, signUpViaApi } from "./helpers";

// The snippet, running on "another website" (a made-up page on a small web server of its own) and sending to the
// real API and database. That makes the cross-site call, and its CORS answer, real.

test.skip(!LOCAL_ONLY, "needs direct database access");

const API = "http://127.0.0.1:4000";

// "Another website": a real little web server on this computer, so the browser treats it like any
// other site calling our API (a page that is only faked inside the test runner is blocked by Chrome's
// private-network rules, which a real site never meets).
type Host = { origin: string; setHtml: (html: string) => void; close: () => Promise<void> };

async function startHost(): Promise<Host> {
  let html = "";
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "text/html");
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, "localhost", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://localhost:${port}`,
    setHtml: (h) => {
      html = h;
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Opens a made-up page of "the host app" with the snippet in it, and waits until the snippet has started. */
async function openHostApp(page: Page, host: Host, opts: { key: string; api?: string; path?: string; before?: string }) {
  host.setHtml(`<!doctype html><html><body><h1>Host app</h1>${opts.before ?? ""}
    <script src="${BASE}/p.js" data-key="${opts.key}" data-api="${opts.api ?? API}" async></script></body></html>`);
  const seen: string[] = [];
  const onConsole = (m: { type(): string; text(): string }) => seen.push(`console ${m.type()}: ${m.text()}`);
  const onFail = (r: { url(): string; failure(): { errorText: string } | null }) => seen.push(`request failed: ${r.url()} ${r.failure()?.errorText}`);
  const onError = (e: Error) => seen.push(`page error: ${e.message}`);
  page.on("console", onConsole);
  page.on("requestfailed", onFail);
  page.on("pageerror", onError);
  await page.goto(`${host.origin}${opts.path ?? "/"}`);
  try {
    await page.waitForFunction(() => typeof (window as unknown as { pulse?: { track?: unknown } }).pulse?.track === "function", undefined, { timeout: 10_000 });
  } catch {
    throw new Error("The snippet did not start. The page saw: " + (seen.join(" | ") || "(nothing)"));
  } finally {
    page.off("console", onConsole);
    page.off("requestfailed", onFail);
    page.off("pageerror", onError);
  }
}

const track = (page: Page, name: string) => page.evaluate((n) => (window as unknown as { pulse: { track: (n: string) => void } }).pulse.track(n), name);

async function eventsFor(siteId: string) {
  const db = await ownerDb();
  try {
    return (await db.query("select anon_id, name from events where site_id = $1 order by id", [siteId])).rows as { anon_id: string; name: string }[];
  } finally {
    await db.end();
  }
}

test.describe("the snippet", () => {
  let host: Host;
  test.beforeEach(async ({ page }) => {
    await signUpViaApi(page);
    host = await startHost();
  });
  test.afterEach(async () => {
    await host.close();
  });

  test("an event from another website reaches the database as just a name and a browser id @core", async ({ page }) => {
    const site = await createSiteViaApi(page);
    const sent: { body: string; headers: Record<string, string> }[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/v1/track") && r.method() === "POST") sent.push({ body: r.postData() ?? "", headers: r.headers() });
    });

    await openHostApp(page, host, { key: site.key });
    await track(page, "queue_joined");
    await expect.poll(async () => (await eventsFor(site.id)).length).toBe(1);

    const [row] = await eventsFor(site.id);
    expect(row!.name).toBe("queue_joined");
    expect(row!.anon_id).toMatch(/^[a-z0-9]{16,32}$/);

    // what went over the wire: exactly three fields, as plain text, with no cookie
    expect(sent).toHaveLength(1);
    expect(Object.keys(JSON.parse(sent[0]!.body)).sort()).toEqual(["anon", "key", "name"]);
    expect(sent[0]!.headers["content-type"]).toContain("text/plain");
    expect(sent[0]!.headers["cookie"]).toBeUndefined();
  });

  test("a page address with a private token in it is never sent or stored (rule P-1)", async ({ page }) => {
    const site = await createSiteViaApi(page);
    const bodies: string[] = [];
    page.on("request", (r) => {
      if (r.url().endsWith("/v1/track")) bodies.push(`${r.url()} ${r.postData() ?? ""} ${JSON.stringify(r.headers())}`);
    });

    await openHostApp(page, host, { key: site.key, path: "/m/Zq8xKd93LmTokenValue77?invite=secretcode&name=Ali" });
    await track(page, "member_page_viewed");
    await expect.poll(async () => (await eventsFor(site.id)).length).toBe(1);

    const everything = bodies.join("\n") + JSON.stringify(await eventsFor(site.id));
    for (const secret of ["Zq8xKd93LmTokenValue77", "secretcode", "invite", "Ali", "/m/"]) {
      expect(everything, `leaked ${secret}`).not.toContain(secret);
    }
    // The browser itself adds the site's own address (origin only) as the Referer of a cross-site call.
    // That is a domain, not a page address: it never has a path or query. And the server keeps none of it.
    const referers = bodies.map((b) => /"referer":"([^"]*)"/.exec(b)?.[1]).filter(Boolean);
    for (const referer of referers) expect(referer).toBe(`${host.origin}/`);
    expect(JSON.stringify(await eventsFor(site.id))).not.toContain(host.origin.replace("http://", ""));
  });

  test("the browser id stays the same on the next page load, and differs between browsers", async ({ page, browser }) => {
    const site = await createSiteViaApi(page);
    await openHostApp(page, host, { key: site.key });
    await track(page, "queue_joined");
    await expect.poll(async () => (await eventsFor(site.id)).length).toBe(1);
    await page.reload();
    await page.waitForFunction(() => typeof (window as unknown as { pulse?: { track?: unknown } }).pulse?.track === "function");
    await track(page, "status_viewed");
    await expect.poll(async () => (await eventsFor(site.id)).length).toBe(2);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await openHostApp(otherPage, host, { key: site.key });
    await track(otherPage, "queue_joined");
    await expect.poll(async () => (await eventsFor(site.id)).length).toBe(3);
    await other.close();

    const rows = await eventsFor(site.id);
    expect(rows[0]!.anon_id).toBe(rows[1]!.anon_id);
    expect(rows[2]!.anon_id).not.toBe(rows[0]!.anon_id);
  });

  test("a visitor who asked not to be tracked is not tracked, and nothing is stored in their browser", async ({ page }) => {
    const site = await createSiteViaApi(page);
    await page.addInitScript(() => Object.defineProperty(navigator, "doNotTrack", { get: () => "1" }));
    let requests = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/v1/track")) requests++;
    });
    await openHostApp(page, host, { key: site.key });
    await track(page, "queue_joined");
    await page.waitForTimeout(800);
    expect(requests).toBe(0);
    expect(await eventsFor(site.id)).toHaveLength(0);
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("pm_")));
    expect(stored).toEqual([]);
  });

  test("a name that is not a fixed event name is dropped quietly, without an error", async ({ page }) => {
    const site = await createSiteViaApi(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    let requests = 0;
    page.on("request", (r) => {
      if (r.url().endsWith("/v1/track")) requests++;
    });
    await openHostApp(page, host, { key: site.key });
    for (const bad of ["/m/abc123", "ali@example.com", "Queue Joined", "", "x".repeat(60)]) await track(page, bad);
    await page.evaluate(() => (window as unknown as { pulse: { track: (n: unknown) => void } }).pulse.track(undefined));
    await page.waitForTimeout(600);
    expect(requests).toBe(0);
    expect(errors).toEqual([]);
  });

  test("when the server cannot be reached nothing breaks, and the name is sent on the next page view", async ({ page }) => {
    const site = await createSiteViaApi(page);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    await openHostApp(page, host, { key: site.key, api: "http://127.0.0.1:1" }); // nothing listens there
    await track(page, "queue_joined");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("pm_q"))).toContain("queue_joined");
    expect(errors).toEqual([]);
    // only the name was kept, never an address
    expect(await page.evaluate(() => localStorage.getItem("pm_q"))).toBe('["queue_joined"]');

    // next page view, server reachable: the waiting name goes out
    await openHostApp(page, host, { key: site.key });
    await expect.poll(async () => (await eventsFor(site.id)).map((r) => r.name)).toEqual(["queue_joined"]);
    expect(await page.evaluate(() => localStorage.getItem("pm_q"))).toBe("[]");
  });

  test("events called before the script has loaded are sent once it has", async ({ page }) => {
    const site = await createSiteViaApi(page);
    await openHostApp(page, host, {
      key: site.key,
      before: `<script>window.pulse = window.pulse || { q: [], track: function (n) { this.q.push(n); } }; pulse.track("queue_joined");</script>`,
    });
    await expect.poll(async () => (await eventsFor(site.id)).map((r) => r.name)).toEqual(["queue_joined"]);
  });

  test("is under 1 KB", async ({ request }) => {
    const res = await request.get(`${BASE}/p.js`);
    expect(res.ok()).toBe(true);
    expect((await res.body()).length).toBeLessThan(1024);
  });
});
