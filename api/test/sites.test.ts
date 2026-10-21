import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool, recordEvent } from "../src/db/client";
import { newAnon, newId, urls } from "./helpers";

// Sites and their keys, through the real Express app and a real local Postgres.

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
let ingestPool: ReturnType<typeof createPool>;
let closeAll: () => Promise<void>;

beforeAll(() => {
  const { db, pool } = createDb(urls.app());
  ingestPool = createPool(urls.ingest(), 2);
  app = createApp({ config, db, ingestPool, auth: createAuth(db, config) });
  closeAll = async () => {
    await pool.end();
    await ingestPool.end();
  };
});
afterAll(async () => closeAll());

const PASSWORD = "a-long-enough-password";
async function newOwner(): Promise<string> {
  const res = await request(app)
    .post("/v1/auth/sign-up/email")
    .set("Origin", ORIGIN)
    .send({ name: "Owner", email: `${newId("o")}@example.com`, password: PASSWORD });
  return (res.headers["set-cookie"] as unknown as string[]).map((c) => c.split(";")[0]).join("; ");
}
const api = (cookie: string) => ({
  get: (p: string) => request(app).get(p).set("Cookie", cookie),
  post: (p: string, body: object = {}) => request(app).post(p).set("Cookie", cookie).send(body),
  patch: (p: string, body: object) => request(app).patch(p).set("Cookie", cookie).send(body),
});

describe("sites", () => {
  it("need a signed-in owner", async () => {
    expect((await request(app).get("/v1/sites")).status).toBe(401);
    expect((await request(app).post("/v1/sites").send({ name: "x" })).status).toBe(401);
  });

  it("an owner creates a site and gets a 24 character key and an empty 14 day history", async () => {
    const a = api(await newOwner());
    const res = await a.post("/v1/sites", { name: "QueueCare" });
    expect(res.status).toBe(201);
    expect(res.body.site.name).toBe("QueueCare");
    expect(res.body.site.key).toMatch(/^[a-f0-9]{24}$/);
    expect(res.body.site.eventCount).toBe(0);
    expect(res.body.site.daily).toHaveLength(14);
    expect(res.body.site.daily.every((n: number) => n === 0)).toBe(true);
  });

  it("refuses a missing name, a name over 60 characters, and unknown fields", async () => {
    const a = api(await newOwner());
    const none = await a.post("/v1/sites", {});
    expect(none.status).toBe(400);
    const spaces = await a.post("/v1/sites", { name: "   " });
    expect(spaces.status).toBe(400);
    expect(spaces.body.error).toContain("Give the site a name.");
    const long = await a.post("/v1/sites", { name: "x".repeat(61) });
    expect(long.status).toBe(400);
    const extra = await a.post("/v1/sites", { name: "ok", ownerId: "someone-else" });
    expect(extra.status).toBe(400);
  });

  it("lists only the owner's own sites", async () => {
    const alice = api(await newOwner());
    const bob = api(await newOwner());
    await alice.post("/v1/sites", { name: "Alice's app" });
    await bob.post("/v1/sites", { name: "Bob's app" });
    const names = (await alice.get("/v1/sites")).body.sites.map((s: { name: string }) => s.name);
    expect(names).toEqual(["Alice's app"]);
  });

  it("another owner's site looks like a site that does not exist", async () => {
    const alice = api(await newOwner());
    const bob = api(await newOwner());
    const id = (await alice.post("/v1/sites", { name: "Private" })).body.site.id;
    expect((await bob.get(`/v1/sites/${id}`)).status).toBe(404);
    expect((await bob.patch(`/v1/sites/${id}`, { name: "Mine now" })).status).toBe(404);
    expect((await bob.post(`/v1/sites/${id}/rotate-key`)).status).toBe(404);
    expect((await alice.get(`/v1/sites/${id}`)).status).toBe(200);
  });

  it("a made-up id is a plain 404", async () => {
    const a = api(await newOwner());
    expect((await a.get("/v1/sites/not-an-id")).status).toBe(404);
    expect((await a.get("/v1/sites/00000000-0000-4000-8000-000000000000")).status).toBe(404);
  });

  it("renames a site", async () => {
    const a = api(await newOwner());
    const id = (await a.post("/v1/sites", { name: "Old name" })).body.site.id;
    const res = await a.patch(`/v1/sites/${id}`, { name: "New name" });
    expect(res.status).toBe(200);
    expect(res.body.site.name).toBe("New name");
  });

  it("replacing the key stops the old key working at once and starts the new one", async () => {
    const a = api(await newOwner());
    const site = (await a.post("/v1/sites", { name: "Rotating" })).body.site;
    expect(await recordEvent(ingestPool, site.key, newAnon(), "queue_joined")).toBe("ok");

    const rotated = (await a.post(`/v1/sites/${site.id}/rotate-key`)).body.site;
    expect(rotated.key).toMatch(/^[a-f0-9]{24}$/);
    expect(rotated.key).not.toBe(site.key);

    expect(await recordEvent(ingestPool, site.key, newAnon(), "queue_joined")).toBe("unknown_key");
    expect(await recordEvent(ingestPool, rotated.key, newAnon(), "queue_joined")).toBe("ok");
  });

  it("shows how many browsers were active today", async () => {
    const a = api(await newOwner());
    const site = (await a.post("/v1/sites", { name: "Busy" })).body.site;
    const anon = newAnon();
    await recordEvent(ingestPool, site.key, anon, "queue_joined");
    await recordEvent(ingestPool, site.key, anon, "status_viewed");
    await recordEvent(ingestPool, site.key, newAnon(), "queue_joined");
    const listed = (await a.get("/v1/sites")).body.sites[0];
    expect(listed.eventCount).toBe(3);
    expect(listed.daily[13]).toBe(2); // two different browsers today
  });

  it("allows at most 10 sites per owner", async () => {
    const a = api(await newOwner());
    for (let i = 0; i < 10; i++) expect((await a.post("/v1/sites", { name: `Site ${i}` })).status).toBe(201);
    const over = await a.post("/v1/sites", { name: "One too many" });
    expect(over.status).toBe(409);
    expect(over.body.error).toContain("up to 10 sites");
  });
});
