import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { Client } from "pg";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool } from "../src/db/client";
import { connect, newAnon, newId, seedEvent, urls } from "./helpers";

// Daily active browsers: the numbers, and the Pakistan-time day boundary.

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

let app: Express;
let owner: Client;
let closeAll: () => Promise<void>;

beforeAll(async () => {
  const { db, pool } = createDb(urls.app());
  const ingestPool = createPool(urls.ingest(), 2);
  app = createApp({ config, db, ingestPool, auth: createAuth(db, config) });
  owner = await connect(urls.owner());
  closeAll = async () => {
    await owner.end();
    await pool.end();
    await ingestPool.end();
  };
});
afterAll(async () => closeAll());

async function newOwner(): Promise<string> {
  const res = await request(app)
    .post("/v1/auth/sign-up/email")
    .set("Origin", ORIGIN)
    .send({ name: "Owner", email: `${newId("d")}@example.com`, password: "a-long-enough-password" });
  return (res.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
}
async function newSite(cookie: string): Promise<{ id: string }> {
  return (await request(app).post("/v1/sites").set("Cookie", cookie).send({ name: "Daily" })).body.site;
}
const daily = (cookie: string, id: string, query = "") => request(app).get(`/v1/sites/${id}/daily${query}`).set("Cookie", cookie);
const peopleByDay = (body: { days: { day: string; people: number }[] }) => Object.fromEntries(body.days.map((d) => [d.day, d.people]));

describe("GET /v1/sites/:id/daily", () => {
  it("needs a signed-in owner and an existing site", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    expect((await request(app).get(`/v1/sites/${site.id}/daily`)).status).toBe(401);
    expect((await daily(cookie, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await daily(cookie, "nope")).status).toBe(404);
  });

  it("another owner cannot read it", async () => {
    const alice = await newOwner();
    const bob = await newOwner();
    const site = await newSite(alice);
    expect((await daily(bob, site.id)).status).toBe(404);
  });

  it("returns 14 days by default, ending today, with zeros where nothing happened", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    const res = await daily(cookie, site.id);
    expect(res.status).toBe(200);
    expect(res.body.range).toBe(14);
    expect(res.body.days).toHaveLength(14);
    expect(res.body.days.at(-1).day).toBe(res.body.today);
    expect(res.body.days.every((d: { people: number }) => d.people === 0)).toBe(true);
  });

  it("accepts 7, 14 or 30 days and nothing else", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    for (const days of [7, 14, 30]) expect((await daily(cookie, site.id, `?days=${days}`)).body.days).toHaveLength(days);
    expect((await daily(cookie, site.id, "?days=5")).status).toBe(400);
    expect((await daily(cookie, site.id, "?days=abc")).status).toBe(400);
    expect((await daily(cookie, site.id, "?to=yesterday")).status).toBe(400);
  });

  it("counts each browser once per day, however many events it sent", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    const a = newAnon();
    const b = newAnon();
    // 2026-10-20 at noon in Pakistan (07:00 UTC)
    for (const t of ["2026-10-20T07:00:00Z", "2026-10-20T08:00:00Z", "2026-10-20T09:00:00Z"]) await seedEvent(owner, site.id, a, "queue_joined", t);
    await seedEvent(owner, site.id, b, "queue_joined", "2026-10-20T10:00:00Z");
    const res = await daily(cookie, site.id, "?days=7&to=2026-10-21");
    expect(peopleByDay(res.body)["2026-10-20"]).toBe(2);
    expect(peopleByDay(res.body)["2026-10-21"]).toBe(0);
  });

  it("counts the same browser again on a later day", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    const a = newAnon();
    await seedEvent(owner, site.id, a, "queue_joined", "2026-10-19T07:00:00Z");
    await seedEvent(owner, site.id, a, "queue_joined", "2026-10-20T07:00:00Z");
    const days = peopleByDay((await daily(cookie, site.id, "?days=7&to=2026-10-21")).body);
    expect(days["2026-10-19"]).toBe(1);
    expect(days["2026-10-20"]).toBe(1);
  });

  it("splits days at midnight in Pakistan (19:00 UTC), not at midnight UTC", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    const late = newAnon();
    const early = newAnon();
    // 23:59 in Pakistan on the 20th is 18:59 UTC on the 20th: still the 20th.
    await seedEvent(owner, site.id, late, "queue_joined", "2026-10-20T18:59:00Z");
    // 00:00 in Pakistan on the 21st is 19:00 UTC on the 20th: already the 21st, although UTC says the 20th.
    await seedEvent(owner, site.id, early, "queue_joined", "2026-10-20T19:00:00Z");
    const days = peopleByDay((await daily(cookie, site.id, "?days=7&to=2026-10-21")).body);
    expect(days["2026-10-20"]).toBe(1);
    expect(days["2026-10-21"]).toBe(1);
  });

  it("does not count events outside the range", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    await seedEvent(owner, site.id, newAnon(), "queue_joined", "2026-09-01T07:00:00Z");
    const total = (await daily(cookie, site.id, "?days=7&to=2026-10-21")).body.days.reduce((n: number, d: { people: number }) => n + d.people, 0);
    expect(total).toBe(0);
  });

  it("never mixes in another site's events", async () => {
    const cookie = await newOwner();
    const one = await newSite(cookie);
    const two = await newSite(cookie);
    await seedEvent(owner, two.id, newAnon(), "queue_joined", "2026-10-20T07:00:00Z");
    expect(peopleByDay((await daily(cookie, one.id, "?days=7&to=2026-10-21")).body)["2026-10-20"]).toBe(0);
    expect(peopleByDay((await daily(cookie, two.id, "?days=7&to=2026-10-21")).body)["2026-10-20"]).toBe(1);
  });
});
