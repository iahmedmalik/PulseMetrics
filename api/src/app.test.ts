import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createApp } from "./app";
import { validateBody } from "./validate";

describe("API foundation", () => {
  const app = createApp();

  it("answers the pinger on /health", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("does not announce that it is Express", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("answers an unknown address with a plain 404", async () => {
    const res = await request(app).get("/nothing-here");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found." });
  });

  it("answers broken JSON with a 400, not a 500", async () => {
    const res = await request(app).post("/health").set("Content-Type", "application/json").send("{oops");
    expect(res.status).toBe(400);
  });

  it("refuses a body that is too large", async () => {
    const res = await request(app).post("/health").send({ big: "x".repeat(20_000) });
    expect(res.status).toBe(413);
  });
});

describe("validateBody", () => {
  const schema = z.object({ name: z.string() }).strict();
  const app = express();
  app.use(express.json());
  app.post("/t", validateBody(schema), (req, res) => {
    res.json(req.body);
  });

  it("passes a valid body through", async () => {
    const res = await request(app).post("/t").send({ name: "a" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ name: "a" });
  });

  it("refuses an unknown field (strict schemas, rule P-1)", async () => {
    const res = await request(app).post("/t").send({ name: "a", extra: 1 });
    expect(res.status).toBe(400);
  });

  it("refuses a missing field", async () => {
    const res = await request(app).post("/t").send({});
    expect(res.status).toBe(400);
  });
});
