import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { Client } from "pg";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool } from "../src/db/client";
import { asOwner, connect, newAnon, newId, seedEvent, seedOwner, seedSite, urls } from "./helpers";

// The funnel: the SQL function itself (as the dashboard role, with row-level security on), then the API route.

const ORIGIN = "http://localhost:3400";
const config: Config = {
  DATABASE_URL_APP: "",
  DATABASE_URL_INGEST: "",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-test-secret",
  CRON_SECRET: "test-cron-secret-123",
  WEB_ORIGIN: ORIGIN,
  PORT: 4000,
  NODE_ENV: "test",
  isProduction: false,
};

const STEPS = ["queue_joined", "status_viewed", "called_in"];
const T = (h: number, m = 0) => `2026-10-20T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
const FROM = "2026-10-20T00:00:00Z";
const TO = "2026-10-21T00:00:00Z";

let owner: Client;
let app: Client; // pm_app
let closeAll: () => Promise<void>;
let web: Express;

beforeAll(async () => {
  owner = await connect(urls.owner());
  app = await connect(urls.app());
  const { db, pool } = createDb(urls.app());
  const ingestPool = createPool(urls.ingest(), 2);
  web = createApp({ config, db, ingestPool, auth: createAuth(db, config) });
  closeAll = async () => {
    await owner.end();
    await app.end();
    await pool.end();
    await ingestPool.end();
  };
});
afterAll(async () => closeAll());

async function funnel(ownerId: string, siteId: string, steps = STEPS, from = FROM, to = TO): Promise<number[]> {
  return asOwner(app, ownerId, async () => {
    const res = await app.query("select step, name, people from funnel($1, $2, $3, $4) order by step", [siteId, steps, from, to]);
    return res.rows.map((r) => Number(r.people));
  });
}

async function scene() {
  const ownerId = newId("funnel");
  await seedOwner(owner, ownerId);
  const site = await seedSite(owner, ownerId, "Funnel site");
  return { ownerId, site };
}

describe("funnel() the SQL function", () => {
  it("counts each browser at the furthest step it reached, in order", async () => {
    const { ownerId, site } = await scene();
    const [A, B, C, D, E, F, G] = Array.from({ length: 7 }, newAnon) as [string, string, string, string, string, string, string];
    // A: all three, in order
    await seedEvent(owner, site.id, A, "queue_joined", T(8));
    await seedEvent(owner, site.id, A, "status_viewed", T(9));
    await seedEvent(owner, site.id, A, "called_in", T(10));
    // B: the first two
    await seedEvent(owner, site.id, B, "queue_joined", T(8));
    await seedEvent(owner, site.id, B, "status_viewed", T(9));
    // C: only the first
    await seedEvent(owner, site.id, C, "queue_joined", T(8));
    // D: did step 2 BEFORE step 1: out of order, so stuck at step 1
    await seedEvent(owner, site.id, D, "status_viewed", T(8));
    await seedEvent(owner, site.id, D, "queue_joined", T(9));
    // E: only step 2, never step 1: not in the funnel at all
    await seedEvent(owner, site.id, E, "status_viewed", T(8));
    // F: repeats every step: counted once
    await seedEvent(owner, site.id, F, "queue_joined", T(8));
    await seedEvent(owner, site.id, F, "queue_joined", T(8, 30));
    await seedEvent(owner, site.id, F, "status_viewed", T(9));
    await seedEvent(owner, site.id, F, "status_viewed", T(9, 30));
    // G: only step 3
    await seedEvent(owner, site.id, G, "called_in", T(8));

    expect(await funnel(ownerId, site.id)).toEqual([5, 3, 1]); // A B C D F | A B F | A
  });

  it("only counts a step that comes AFTER the previous one, not at the same moment", async () => {
    const { ownerId, site } = await scene();
    const a = newAnon();
    await seedEvent(owner, site.id, a, "queue_joined", T(8));
    await seedEvent(owner, site.id, a, "status_viewed", T(8)); // exactly the same time
    expect(await funnel(ownerId, site.id)).toEqual([1, 0, 0]);
  });

  it("follows the first valid path, so an early repeat does not hide a later step", async () => {
    const { ownerId, site } = await scene();
    const a = newAnon();
    // status_viewed happens before the FIRST queue_joined, but also after the SECOND one
    await seedEvent(owner, site.id, a, "status_viewed", T(7));
    await seedEvent(owner, site.id, a, "queue_joined", T(8));
    await seedEvent(owner, site.id, a, "status_viewed", T(9));
    expect(await funnel(ownerId, site.id)).toEqual([1, 1, 0]);
  });

  it("ignores events outside the time range", async () => {
    const { ownerId, site } = await scene();
    const a = newAnon();
    await seedEvent(owner, site.id, a, "queue_joined", "2026-10-19T08:00:00Z"); // the day before
    await seedEvent(owner, site.id, a, "status_viewed", T(9));
    expect(await funnel(ownerId, site.id)).toEqual([0, 0, 0]); // step 1 happened outside the range
    await seedEvent(owner, site.id, a, "called_in", "2026-10-21T08:00:00Z"); // the day after
    expect(await funnel(ownerId, site.id, STEPS, "2026-10-19T00:00:00Z", TO)).toEqual([1, 1, 0]);
  });

  it("always answers with one row per step, with zeros where nobody got to", async () => {
    const { ownerId, site } = await scene();
    expect(await funnel(ownerId, site.id)).toEqual([0, 0, 0]);
    expect(await funnel(ownerId, site.id, ["queue_joined", "called_in"])).toEqual([0, 0]);
  });

  it("works for two steps and for six", async () => {
    const { ownerId, site } = await scene();
    const a = newAnon();
    const names = ["one_a", "two_b", "three_c", "four_d", "five_e", "six_f"];
    for (let i = 0; i < names.length; i++) await seedEvent(owner, site.id, a, names[i]!, T(8 + i));
    expect(await funnel(ownerId, site.id, names)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(await funnel(ownerId, site.id, names.slice(0, 2))).toEqual([1, 1]);
  });

  it("never mixes in another site's events", async () => {
    const { ownerId, site } = await scene();
    const other = await seedSite(owner, ownerId, "Another site");
    await seedEvent(owner, other.id, newAnon(), "queue_joined", T(8));
    expect(await funnel(ownerId, site.id)).toEqual([0, 0, 0]);
    expect(await funnel(ownerId, other.id)).toEqual([1, 0, 0]);
  });

  it("another owner sees nothing, because row-level security hides the events", async () => {
    const { site } = await scene();
    await seedEvent(owner, site.id, newAnon(), "queue_joined", T(8));
    const stranger = newId("stranger");
    await seedOwner(owner, stranger);
    expect(await funnel(stranger, site.id)).toEqual([0, 0, 0]);
  });

  it("answers nothing for an empty list of steps", async () => {
    const { ownerId, site } = await scene();
    expect(await funnel(ownerId, site.id, [])).toEqual([]);
  });
});

describe("GET /v1/sites/:id/funnel and /names", () => {
  async function newOwnerCookie(): Promise<string> {
    const res = await request(web)
      .post("/v1/auth/sign-up/email")
      .set("Origin", ORIGIN)
      .send({ name: "Owner", email: `${newId("f")}@example.com`, password: "a-long-enough-password" });
    return (res.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
  }
  const makeSite = async (cookie: string) => (await request(web).post("/v1/sites").set("Cookie", cookie).send({ name: "F" })).body.site as { id: string };
  const get = (cookie: string, path: string) => request(web).get(path).set("Cookie", cookie);

  it("returns the people at each step in order", async () => {
    const cookie = await newOwnerCookie();
    const site = await makeSite(cookie);
    const a = newAnon();
    const b = newAnon();
    await seedEvent(owner, site.id, a, "queue_joined", T(8));
    await seedEvent(owner, site.id, a, "status_viewed", T(9));
    await seedEvent(owner, site.id, b, "queue_joined", T(8));
    const res = await get(cookie, `/v1/sites/${site.id}/funnel?steps=queue_joined,status_viewed,called_in&days=7&to=2026-10-20`);
    expect(res.status).toBe(200);
    expect(res.body.range).toBe(7);
    expect(res.body.steps).toEqual([
      { step: 1, name: "queue_joined", people: 2 },
      { step: 2, name: "status_viewed", people: 1 },
      { step: 3, name: "called_in", people: 0 },
    ]);
  });

  it("uses Pakistan days for the range: an event at 00:30 on the 21st counts for the 21st only", async () => {
    const cookie = await newOwnerCookie();
    const site = await makeSite(cookie);
    const a = newAnon();
    await seedEvent(owner, site.id, a, "queue_joined", "2026-10-20T19:30:00Z"); // 00:30 on the 21st in Pakistan
    const on21 = await get(cookie, `/v1/sites/${site.id}/funnel?steps=queue_joined,called_in&days=7&to=2026-10-21`);
    expect(on21.body.steps[0].people).toBe(1);
    const upTo20 = await get(cookie, `/v1/sites/${site.id}/funnel?steps=queue_joined,called_in&days=7&to=2026-10-20`);
    expect(upTo20.body.steps[0].people).toBe(0);
  });

  it("refuses steps that are missing, too few, too many, repeated, or not fixed event names", async () => {
    const cookie = await newOwnerCookie();
    const site = await makeSite(cookie);
    const bad = [
      "",
      "?steps=queue_joined",
      "?steps=a_b,b_c,c_d,d_e,e_f,f_g,g_h",
      "?steps=queue_joined,queue_joined",
      "?steps=queue_joined,/m/abc123",
      "?steps=queue_joined,ali@example.com",
      "?steps=queue_joined,Called%20In",
      "?steps=queue_joined,called_in&days=3",
    ];
    for (const q of bad) expect((await get(cookie, `/v1/sites/${site.id}/funnel${q}`)).status, q).toBe(400);
  });

  it("needs sign-in, and another owner's site is a 404", async () => {
    const alice = await newOwnerCookie();
    const bob = await newOwnerCookie();
    const site = await makeSite(alice);
    expect((await request(web).get(`/v1/sites/${site.id}/funnel?steps=queue_joined,called_in`)).status).toBe(401);
    expect((await get(bob, `/v1/sites/${site.id}/funnel?steps=queue_joined,called_in`)).status).toBe(404);
    expect((await get(bob, `/v1/sites/${site.id}/names`)).status).toBe(404);
  });

  it("lists the event names a site has sent, in the order they were first seen", async () => {
    const cookie = await newOwnerCookie();
    const site = await makeSite(cookie);
    await seedEvent(owner, site.id, newAnon(), "status_viewed", T(9));
    await seedEvent(owner, site.id, newAnon(), "queue_joined", T(8));
    await seedEvent(owner, site.id, newAnon(), "queue_joined", T(10));
    const res = await get(cookie, `/v1/sites/${site.id}/names`);
    expect(res.status).toBe(200);
    expect(res.body.names.map((n: { name: string }) => n.name)).toEqual(["queue_joined", "status_viewed"]);
    expect(res.body.names.map((n: { count: number }) => n.count)).toEqual([2, 1]);
  });
});
