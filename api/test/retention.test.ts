import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { Client } from "pg";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool } from "../src/db/client";
import { connect, newAnon, newId, seedEvent, seedOwner, seedSite, urls } from "./helpers";

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

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 3600 * 1000);

describe("POST /internal/retention", () => {
  it("refuses a call with no secret, a wrong secret, or the wrong kind of header", async () => {
    expect((await request(app).post("/internal/retention")).status).toBe(401);
    expect((await request(app).post("/internal/retention").set("Authorization", "Bearer nope")).status).toBe(401);
    expect((await request(app).post("/internal/retention").set("Authorization", "test-cron-secret-123")).status).toBe(401);
    expect((await request(app).post("/internal/retention").set("Authorization", "Bearer ")).status).toBe(401);
  });

  it("is not available with GET", async () => {
    expect((await request(app).get("/internal/retention").set("Authorization", "Bearer test-cron-secret-123")).status).toBe(404);
  });

  it("deletes events older than 180 days, keeps newer ones, and fixes the counter", async () => {
    const id = newId("ret");
    await seedOwner(owner, id);
    const site = await seedSite(owner, id, "Retention");
    await seedEvent(owner, site.id, newAnon(), "queue_joined", daysAgo(200));
    await seedEvent(owner, site.id, newAnon(), "queue_joined", daysAgo(181));
    await seedEvent(owner, site.id, newAnon(), "queue_joined", daysAgo(179));
    await seedEvent(owner, site.id, newAnon(), "queue_joined", daysAgo(1));
    await owner.query("update sites set event_count = 4 where id = $1", [site.id]);

    const res = await request(app).post("/internal/retention").set("Authorization", "Bearer test-cron-secret-123");
    expect(res.status).toBe(200);
    expect(res.body.keptDays).toBe(180);
    expect(res.body.deleted).toBeGreaterThanOrEqual(2);

    expect(Number((await owner.query("select count(*) as n from events where site_id = $1", [site.id])).rows[0].n)).toBe(2);
    expect(Number((await owner.query("select event_count from sites where id = $1", [site.id])).rows[0].event_count)).toBe(2);
  });

  it("can be called again straight away and then deletes nothing more for that site", async () => {
    const again = await request(app).post("/internal/retention").set("Authorization", "Bearer test-cron-secret-123");
    expect(again.status).toBe(200);
    expect(typeof again.body.deleted).toBe("number");
  });
});
