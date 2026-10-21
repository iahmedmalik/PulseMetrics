import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import { Router, type RequestHandler } from "express";
import type { AppContext } from "../app";
import { HttpError } from "../http-error";

// Routes for the scheduler, not for people. Each one needs the shared secret in an Authorization header.
// (Render's free plan has no cron jobs, so a free outside scheduler calls these once a day.)

export const RETENTION_DAYS = 180;

function sameSecret(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  // timingSafeEqual needs equal lengths; comparing lengths first leaks only the length, which is fine
  return a.length === b.length && timingSafeEqual(a, b);
}

export function internalRouter(ctx: AppContext): Router {
  const router = Router();

  const needSecret: RequestHandler = (req, _res, next) => {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || !sameSecret(token, ctx.config.CRON_SECRET)) return next(new HttpError(401, "Not allowed."));
    next();
  };

  // Deletes events older than 180 days and recalculates each site's counter. Safe to call as often as you like.
  router.post("/retention", needSecret, async (_req, res, next) => {
    try {
      const result = await ctx.db.execute<{ deleted: string }>(sql`select purge_old_events(${RETENTION_DAYS}::int) as deleted`);
      res.json({ deleted: Number(result.rows[0]?.deleted ?? 0), keptDays: RETENTION_DAYS });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
