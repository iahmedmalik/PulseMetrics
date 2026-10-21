import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { Client } from "pg";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool } from "../src/db/client";
import { bucketOf, refusals } from "../src/rate-limit";
import { connect, newAnon, newId, seedOwner, seedSite, urls } from "./helpers";

// The public tracking door cannot be flooded, and the limiter never keeps who sent what.

const config: Config = {
  DATABASE_URL_APP: "",
  DATABASE_URL_INGEST: "",
  BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-test-secret",
  CRON_SECRET: "test-cron-secret-123",
  WEB_ORIGIN: "http://localhost:3400",
  PORT: 4000,
  NODE_ENV: "test",
  isProduction: false,
};

let owner: Client;
let siteA: { id: string; key: string };
let siteB: { id: string; key: string };
let closeAll: () => Promise<void>;
let makeApp: (limits: { perIpPerMinute: number; perKeyPerMinute: number }) => Express;

beforeAll(async () => {
  const { db, pool } = createDb(urls.app());
  const ingestPool = createPool(urls.ingest(), 2);
  makeApp = (limits) => createApp({ config, db, ingestPool, auth: createAuth(db, config), limits });
  owner = await connect(urls.owner());
  const id = newId("limiter");
  await seedOwner(owner, id);
  siteA = await seedSite(owner, id, "A");
  siteB = await seedSite(owner, id, "B");
  closeAll = async () => {
    await owner.end();
    await pool.end();
    await ingestPool.end();
  };
});
afterAll(async () => closeAll());

const event = (key: string) => ({ key, anon: newAnon(), name: "queue_joined" });
const from = (app: Express, ip: string, key: string) => request(app).post("/v1/track").set("X-Forwarded-For", ip).send(event(key));

describe("flooding the tracking door", () => {
  it("lets a visitor send up to the limit, then answers 429 with a plain message and Retry-After", async () => {
    const app = makeApp({ perIpPerMinute: 3, perKeyPerMinute: 1000 });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await from(app, "203.0.113.7", siteA.key)).status);
    expect(statuses).toEqual([204, 204, 204, 429, 429]);

    const refused = await from(app, "203.0.113.7", siteA.key);
    expect(refused.status).toBe(429);
    expect(refused.body).toEqual({ error: "Too many events. Slow down and try again in a minute." });
    expect(refused.headers["retry-after"]).toBeDefined();
  });

  it("counts each visitor on their own", async () => {
    const app = makeApp({ perIpPerMinute: 2, perKeyPerMinute: 1000 });
    for (let i = 0; i < 2; i++) expect((await from(app, "203.0.113.10", siteA.key)).status).toBe(204);
    expect((await from(app, "203.0.113.10", siteA.key)).status).toBe(429);
    expect((await from(app, "203.0.113.11", siteA.key)).status).toBe(204); // someone else is not affected
  });

  it("stops one site filling its quota in a burst, without touching another site", async () => {
    const app = makeApp({ perIpPerMinute: 1000, perKeyPerMinute: 3 });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) statuses.push((await from(app, `198.51.100.${i + 1}`, siteA.key)).status);
    expect(statuses).toEqual([204, 204, 204, 429, 429]);
    expect((await from(app, "198.51.100.200", siteB.key)).status).toBe(204);
  });

  it("refuses a flooding visitor before reading or storing anything", async () => {
    const app = makeApp({ perIpPerMinute: 1, perKeyPerMinute: 1000 });
    await from(app, "192.0.2.1", siteA.key);
    const before = Number((await owner.query("select count(*) as n from events where site_id = $1", [siteA.id])).rows[0].n);
    const res = await request(app).post("/v1/track").set("X-Forwarded-For", "192.0.2.1").send({ nonsense: true });
    expect(res.status).toBe(429); // not 400: the limiter answers first
    const after = Number((await owner.query("select count(*) as n from events where site_id = $1", [siteA.id])).rows[0].n);
    expect(after).toBe(before);
  });

  it("counts refusals, with no detail about who sent them", async () => {
    const app = makeApp({ perIpPerMinute: 1, perKeyPerMinute: 1000 });
    const before = refusals.rateLimited;
    await from(app, "192.0.2.50", siteA.key);
    await from(app, "192.0.2.50", siteA.key);
    await from(app, "192.0.2.50", siteA.key);
    expect(refusals.rateLimited).toBe(before + 2);
    const health = await request(app).get("/health");
    expect(health.body.refused.rateLimited).toBeGreaterThanOrEqual(before + 2);
    expect(JSON.stringify(health.body)).not.toContain("192.0.2.50");
  });
});

describe("what the limiter remembers", () => {
  it("turns an address into a short fingerprint that does not contain it", () => {
    const fp = bucketOf("203.0.113.7");
    expect(fp).toHaveLength(16);
    expect(fp).not.toContain("203");
    expect(fp).toMatch(/^[0-9a-f]{16}$/);
  });

  it("gives the same fingerprint for the same address and a different one for another", () => {
    expect(bucketOf("203.0.113.7")).toBe(bucketOf("203.0.113.7"));
    expect(bucketOf("203.0.113.7")).not.toBe(bucketOf("203.0.113.8"));
  });
});
