import { createHash, randomBytes } from "node:crypto";
import { rateLimit, ipKeyGenerator } from "express-rate-limit";
import type { Request, RequestHandler } from "express";

// Limits for the public tracking door (POST /v1/track), the one place anyone on the internet can call.
//
// Two buckets, both kept in memory only (this server runs as one instance):
//   per visitor address:  stops one machine flooding every site
//   per site key:         stops one site from filling its own quota in a burst
//
// Rule P-1 applies here too: the visitor's address is only ever used to count. It is hashed with a random
// salt made when the server starts, so the counting table holds neither addresses nor anything that could be
// turned back into one, and the salt is never written anywhere (a restart forgets everything).

export type Limits = { perIpPerMinute: number; perKeyPerMinute: number };
export const DEFAULT_LIMITS: Limits = { perIpPerMinute: 120, perKeyPerMinute: 1200 };

const salt = randomBytes(16).toString("hex");

/** A short fingerprint for counting. The same input gives the same output until the server restarts. */
export function bucketOf(value: string): string {
  return createHash("sha256").update(salt).update(value).digest("hex").slice(0, 16);
}

/** How many requests were refused, with no detail about who sent them. */
export const refusals = { rateLimited: 0, since: new Date().toISOString() };

function make(limit: number, keyOf: (req: Request) => string): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: (req) => bucketOf(keyOf(req)),
    handler: (_req, res) => {
      refusals.rateLimited += 1;
      res.status(429).json({ error: "Too many events. Slow down and try again in a minute." });
    },
  });
}

/** Before the body is read: cheap to refuse. */
export const perVisitorLimiter = (limits: Limits) => make(limits.perIpPerMinute, (req) => ipKeyGenerator(req.ip ?? "unknown"));

/** After the body is checked, so the key can be trusted to be the right shape. */
export const perSiteLimiter = (limits: Limits) => make(limits.perKeyPerMinute, (req) => String(req.body?.key ?? ""));
