import { isValidAnonId, isValidEventName, isValidSiteKey } from "@pulse/core";
import express, { Router, type RequestHandler } from "express";
import { z } from "zod";
import type { AppContext } from "../app";
import { recordEvent } from "../db/client";
import { HttpError } from "../http-error";
import { DEFAULT_LIMITS, perSiteLimiter, perVisitorLimiter } from "../rate-limit";
import { validateBody } from "../validate";

// POST /v1/track: the one public door. Anyone's page may call it, so it is strict about what comes in
// and generous about nothing else.
//
// Rule P-1: the body is exactly { key, anon, name }. Any other field is refused, so a page address, a
// token, a name or a phone number has nowhere to go. Event names are checked against the same pattern
// the database enforces. No cookies are read or set, and nothing about the visitor (address, browser,
// language) is looked at or kept.

const eventSchema = z
  .object({
    key: z.string().refine(isValidSiteKey, "key must be the 24 character site key"),
    anon: z.string().refine(isValidAnonId, "anon must be 16 to 32 lowercase letters and digits"),
    name: z.string().refine(isValidEventName, "name must be a short fixed event name such as queue_joined"),
  })
  .strict();

// Any website may call this route, with no credentials (so it never carries cookies either way).
const cors: RequestHandler = (_req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Cache-Control", "no-store");
  next();
};

export function trackRouter(ctx: AppContext): Router {
  const router = Router();
  const limits = ctx.limits ?? DEFAULT_LIMITS;
  router.use(cors);
  router.options("/", (_req, res) => {
    res.status(204).end();
  });

  // The snippet sends JSON as text/plain, which browsers allow without a pre-flight check.
  // The body is tiny: 1 KB is far more than an event needs.
  // Order matters: refuse a flooding visitor before reading anything, check the body, then count per site.
  router.post(
    "/",
    perVisitorLimiter(limits),
    express.json({ type: ["application/json", "text/plain"], limit: "1kb" }),
    validateBody(eventSchema),
    perSiteLimiter(limits),
    async (req, res, next) => {
      try {
        const { key, anon, name } = req.body as z.infer<typeof eventSchema>;
        const result = await recordEvent(ctx.ingestPool, key, anon, name);
        if (result === "ok") {
          res.status(204).end();
          return;
        }
        if (result === "unknown_key") throw new HttpError(404, "Unknown site key.");
        if (result === "full") throw new HttpError(429, "This site has reached its event limit.");
        throw new HttpError(400, "The event is not valid.");
      } catch (err) {
        next(err);
      }
    },
  );

  router.all("/", (_req, _res, next) => next(new HttpError(405, "Use POST.")));
  return router;
}
