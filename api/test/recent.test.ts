import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { Client } from "pg";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool } from "../src/db/client";
import { connect, newAnon, newId, seedEvent, urls } from "./helpers";

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
    .send({ name: "Owner", email: `${newId("r")}@example.com`, password: "a-long-enough-password" });
  return (res.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
}
const newSite = async (cookie: string) => (await request(app).post("/v1/sites").set("Cookie", cookie).send({ name: "Recent" })).body.site as { id: string };
const recent = (cookie: string, id: string, q = "") => request(app).get(`/v1/sites/${id}/recent${q}`).set("Cookie", cookie);

describe("GET /v1/sites/:id/recent", () => {
  it("lists the latest events, newest first, with only the first 4 characters of the browser", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    const a = newAnon();
    await seedEvent(owner, site.id, a, "queue_joined", "2026-10-20T08:00:00Z");
    await seedEvent(owner, site.id, a, "status_viewed", "2026-10-20T09:00:00Z");
    const res = await recent(cookie, site.id);
    expect(res.status).toBe(200);
    expect(res.body.events.map((e: { name: string }) => e.name)).toEqual(["status_viewed", "queue_joined"]);
    expect(res.body.events[0].browser).toBe(a.slice(0, 4));
    expect(res.body.events[0].browser).toHaveLength(4);
    expect(JSON.stringify(res.body)).not.toContain(a); // the full id never leaves the database
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("gives 10 by default and honours a limit from 1 to 50", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    for (let i = 0; i < 12; i++) await seedEvent(owner, site.id, newAnon(), "queue_joined", `2026-10-20T08:${String(i).padStart(2, "0")}:00Z`);
    expect((await recent(cookie, site.id)).body.events).toHaveLength(10);
    expect((await recent(cookie, site.id, "?limit=3")).body.events).toHaveLength(3);
    expect((await recent(cookie, site.id, "?limit=0")).status).toBe(400);
    expect((await recent(cookie, site.id, "?limit=51")).status).toBe(400);
    expect((await recent(cookie, site.id, "?limit=x")).status).toBe(400);
  });

  it("is empty for a site with no events", async () => {
    const cookie = await newOwner();
    const site = await newSite(cookie);
    expect((await recent(cookie, site.id)).body.events).toEqual([]);
  });

  it("needs sign-in, and another owner's site is a 404", async () => {
    const alice = await newOwner();
    const bob = await newOwner();
    const site = await newSite(alice);
    expect((await request(app).get(`/v1/sites/${site.id}/recent`)).status).toBe(401);
    expect((await recent(bob, site.id)).status).toBe(404);
    expect((await recent(alice, "nope")).status).toBe(404);
  });

  it("never shows another site's events", async () => {
    const cookie = await newOwner();
    const one = await newSite(cookie);
    const two = await newSite(cookie);
    await seedEvent(owner, two.id, newAnon(), "queue_joined", "2026-10-20T08:00:00Z");
    expect((await recent(cookie, one.id)).body.events).toEqual([]);
    expect((await recent(cookie, two.id)).body.events).toHaveLength(1);
  });
});
