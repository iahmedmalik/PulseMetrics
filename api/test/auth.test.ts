import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import { createApp } from "../src/app";
import { createAuth } from "../src/auth";
import type { Config } from "../src/config";
import { createDb, createPool } from "../src/db/client";
import { connect, newId, urls } from "./helpers";

// Sign-in against a real local Postgres, through the real Express app.

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
let closeAll: () => Promise<void>;

beforeAll(() => {
  const { db, pool } = createDb(urls.app());
  const ingestPool = createPool(urls.ingest(), 2);
  app = createApp({ config, db, ingestPool, auth: createAuth(db, config) });
  closeAll = async () => {
    await pool.end();
    await ingestPool.end();
  };
});
afterAll(async () => closeAll());

const post = (path: string, body: object) => request(app).post(path).set("Origin", ORIGIN).send(body);
const cookieOf = (res: request.Response) => (res.headers["set-cookie"] as unknown as string[] | undefined)?.map((c) => c.split(";")[0]).join("; ") ?? "";
const email = () => `${newId("owner")}@example.com`;
const PASSWORD = "a-long-enough-password";

describe("owner sign-up and sign-in", () => {
  it("signs a new owner up, signs them in at once, and /v1/me knows them", async () => {
    const address = email();
    const res = await post("/v1/auth/sign-up/email", { name: "Ali", email: address, password: PASSWORD });
    expect(res.status).toBe(200);
    const cookie = cookieOf(res);
    expect(cookie).toContain("session_token");

    const me = await request(app).get("/v1/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(address);
    expect(me.body.name).toBe("Ali");
  });

  it("answers /v1/me with 401 and a plain message when nobody is signed in", async () => {
    const res = await request(app).get("/v1/me");
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "Please sign in." });
  });

  it("signs an existing owner in with the right password", async () => {
    const address = email();
    await post("/v1/auth/sign-up/email", { name: "Sana", email: address, password: PASSWORD });
    const res = await post("/v1/auth/sign-in/email", { email: address, password: PASSWORD });
    expect(res.status).toBe(200);
    const me = await request(app).get("/v1/me").set("Cookie", cookieOf(res));
    expect(me.body.email).toBe(address);
  });

  it("refuses the wrong password with a 401 and no session", async () => {
    const address = email();
    await post("/v1/auth/sign-up/email", { name: "Bilal", email: address, password: PASSWORD });
    const res = await post("/v1/auth/sign-in/email", { email: address, password: "not-the-password-1" });
    expect(res.status).toBe(401);
    expect(cookieOf(res)).not.toContain("session_token=ey");
    const me = await request(app).get("/v1/me").set("Cookie", cookieOf(res));
    expect(me.status).toBe(401);
  });

  it("refuses an email nobody signed up with, with the same kind of answer as a wrong password", async () => {
    const res = await post("/v1/auth/sign-in/email", { email: email(), password: PASSWORD });
    expect(res.status).toBe(401);
  });

  it("refuses a password shorter than 10 characters", async () => {
    const res = await post("/v1/auth/sign-up/email", { name: "Short", email: email(), password: "short" });
    expect(res.status).toBe(400);
  });

  it("refuses a second account with the same email", async () => {
    const address = email();
    await post("/v1/auth/sign-up/email", { name: "One", email: address, password: PASSWORD });
    const again = await post("/v1/auth/sign-up/email", { name: "Two", email: address, password: PASSWORD });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(again.status).toBeLessThan(500);
  });

  it("signing out ends the session", async () => {
    const res = await post("/v1/auth/sign-up/email", { name: "Out", email: email(), password: PASSWORD });
    const cookie = cookieOf(res);
    const out = await request(app).post("/v1/auth/sign-out").set("Origin", ORIGIN).set("Cookie", cookie).send({});
    expect(out.status).toBe(200);
    const me = await request(app).get("/v1/me").set("Cookie", cookie);
    expect(me.status).toBe(401);
  });

  it("refuses a state-changing request that arrives from another website with a session cookie (cross-site forgery)", async () => {
    const res = await post("/v1/auth/sign-up/email", { name: "Victim", email: email(), password: PASSWORD });
    const cookie = cookieOf(res);
    const forged = await request(app).post("/v1/auth/sign-out").set("Origin", "https://evil.example").set("Cookie", cookie).send({});
    expect(forged.status).toBe(403);
    // the session is still alive: the forged sign-out did nothing
    const me = await request(app).get("/v1/me").set("Cookie", cookie);
    expect(me.status).toBe(200);
  });
});

describe("guessing passwords is slowed down", () => {
  it("answers 429 after too many sign-in tries in a minute", async () => {
    const { db } = createDb(urls.app());
    const limited = createApp({ config, db, ingestPool: createPool(urls.ingest(), 1), auth: createAuth(db, config, { rateLimit: { enabled: true, signInMax: 3 } }) });
    const address = email();
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await request(limited).post("/v1/auth/sign-in/email").set("Origin", ORIGIN).send({ email: address, password: "wrong-password-1" });
      statuses.push(r.status);
    }
    expect(statuses.slice(0, 3).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(3)).toEqual([429, 429]);
  });
});

describe("what is kept about an owner", () => {
  it("stores the password hashed, never in plain text", async () => {
    const address = email();
    await post("/v1/auth/sign-up/email", { name: "Hash", email: address, password: PASSWORD });
    const owner = await connect(urls.owner());
    const row = await owner.query(`select a.password from account a join "user" u on u.id = a.user_id where u.email = $1`, [address]);
    await owner.end();
    expect(row.rows[0].password).toBeTruthy();
    expect(row.rows[0].password).not.toContain(PASSWORD);
  });

  it("does not keep the owner's IP address on the session", async () => {
    const address = email();
    await post("/v1/auth/sign-up/email", { name: "NoIp", email: address, password: PASSWORD });
    const owner = await connect(urls.owner());
    const row = await owner.query(`select s.ip_address from session s join "user" u on u.id = s.user_id where u.email = $1`, [address]);
    await owner.end();
    expect(row.rows.length).toBeGreaterThan(0);
    expect(row.rows.every((r) => !r.ip_address)).toBe(true);
  });
});
