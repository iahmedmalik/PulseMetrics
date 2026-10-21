import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import type { Client } from "pg";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool } from "../src/db/client";
import { connect, newAnon, newId, seedOwner, seedSite, urls } from "./helpers";

// POST /v1/track against a real local Postgres. This is where rule P-1 is proved: nothing that could
// carry a page address, token, name, phone number or email can get into an event.

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
let site: { id: string; key: string };
let closeAll: () => Promise<void>;

beforeAll(async () => {
  const { db, pool } = createDb(urls.app());
  const ingestPool = createPool(urls.ingest(), 2);
  app = createApp({ config, db, ingestPool, auth: createAuth(db, config) });
  owner = await connect(urls.owner());
  const id = newId("tracker");
  await seedOwner(owner, id);
  site = await seedSite(owner, id, "Tracked");
  closeAll = async () => {
    await owner.end();
    await pool.end();
    await ingestPool.end();
  };
});
afterAll(async () => closeAll());

const track = (body: unknown) => request(app).post("/v1/track").send(body as object);
const count = async () => Number((await owner.query("select count(*) as n from events where site_id = $1", [site.id])).rows[0].n);
const good = () => ({ key: site.key, anon: newAnon(), name: "queue_joined" });

describe("POST /v1/track: valid events", () => {
  it("stores the event and answers 204 with no body", async () => {
    const before = await count();
    const res = await track(good());
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect(await count()).toBe(before + 1);
  });

  it("stores exactly the name and the browser id that were sent", async () => {
    const body = { key: site.key, anon: newAnon(), name: "payment_recorded" };
    await track(body);
    const row = (await owner.query("select anon_id, name from events where anon_id = $1", [body.anon])).rows[0];
    expect(row).toEqual({ anon_id: body.anon, name: "payment_recorded" });
  });

  it("accepts the body as text/plain, the way the snippet sends it without a pre-flight check", async () => {
    const before = await count();
    const res = await request(app).post("/v1/track").set("Content-Type", "text/plain;charset=UTF-8").send(JSON.stringify(good()));
    expect(res.status).toBe(204);
    expect(await count()).toBe(before + 1);
  });
});

describe("POST /v1/track: rule P-1, nothing private can be sent", () => {
  it.each([
    ["a page address", "https://committeekeeper.vercel.app/m/abc123"],
    ["a member link path", "/m/k3j2h4g5f6d7s8a9"],
    ["a token written as a name", "m_k3j2h4g5f6d7s8a9q1w2e3r4"],
    ["an email address", "ali@example.com"],
    ["a phone number", "03001234567"],
    ["a name with capitals", "MemberPageViewed"],
    ["a name with a space", "member page"],
  ])("refuses %s as an event name and stores nothing", async (_label, name) => {
    const before = await count();
    const res = await track({ ...good(), name });
    expect(res.status).toBe(400);
    expect(await count()).toBe(before);
  });

  it.each([
    ["path", "/m/k3j2h4g5f6d7s8a9"],
    ["url", "https://example.com/m/abc"],
    ["href", "https://example.com"],
    ["referrer", "https://example.com"],
    ["email", "ali@example.com"],
    ["props", { phone: "0300" }],
    ["userId", "u-123"],
  ])("refuses a request with an extra '%s' field and stores nothing", async (field, value) => {
    const before = await count();
    const res = await track({ ...good(), [field]: value });
    expect(res.status).toBe(400);
    expect(await count()).toBe(before);
  });

  it("refuses a browser id that is not a random lowercase id", async () => {
    for (const anon of ["Ali Raza", "ali@example.com", "abc", "A3F9K2M1X8Q7W5E4", "https://example.com/abc"]) {
      expect((await track({ ...good(), anon })).status, anon).toBe(400);
    }
  });

  it("refuses missing fields, wrong types, arrays and empty bodies", async () => {
    for (const body of [{}, { key: site.key }, { ...good(), name: 5 }, { ...good(), anon: null }, [good()], "text", null]) {
      expect((await track(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await request(app).post("/v1/track")).status).toBe(400);
  });

  it("refuses a body that is not JSON", async () => {
    const res = await request(app).post("/v1/track").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
  });

  it("refuses a body over 1 KB", async () => {
    const res = await track({ ...good(), padding: "x".repeat(2000) });
    expect(res.status).toBe(413);
  });

  it("never reflects what was sent back to the caller", async () => {
    const res = await track({ ...good(), name: "https://secret.example/m/token123" });
    expect(JSON.stringify(res.body)).not.toContain("secret.example");
    expect(JSON.stringify(res.body)).not.toContain("token123");
  });
});

describe("POST /v1/track: keys and limits", () => {
  it("answers 404 for a well-formed key nobody owns", async () => {
    const res = await track({ ...good(), key: "0".repeat(24) });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Unknown site key." });
  });

  it("answers 400 for a key that is not even the right shape", async () => {
    expect((await track({ ...good(), key: "short" })).status).toBe(400);
  });

  it("answers 429 when the site has reached its limit, and stores nothing", async () => {
    const full = await seedSite(owner, (await owner.query("select owner_id from sites where id = $1", [site.id])).rows[0].owner_id, "Full");
    await owner.query("update sites set event_count = 200000 where id = $1", [full.id]);
    const res = await track({ key: full.key, anon: newAnon(), name: "queue_joined" });
    expect(res.status).toBe(429);
    expect(Number((await owner.query("select count(*) as n from events where site_id = $1", [full.id])).rows[0].n)).toBe(0);
  });

  it("only accepts POST", async () => {
    expect((await request(app).get("/v1/track")).status).toBe(405);
    expect((await request(app).put("/v1/track").send(good())).status).toBe(405);
  });
});

describe("POST /v1/track: other websites may call it, without cookies", () => {
  it("answers the pre-flight check for any origin", async () => {
    const res = await request(app).options("/v1/track").set("Origin", "https://queuecare-zeta.vercel.app").set("Access-Control-Request-Method", "POST");
    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-methods"]).toContain("POST");
  });

  it("allows any origin on the real request, never allows credentials, and sets no cookie", async () => {
    const res = await track(good()).set("Origin", "https://queuecare-zeta.vercel.app");
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("is not cached", async () => {
    expect((await track(good())).headers["cache-control"]).toBe("no-store");
  });
});
