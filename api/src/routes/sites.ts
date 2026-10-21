import { randomBytes } from "node:crypto";
import { sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { AppContext } from "../app";
import { asOwner, type Tx } from "../db/client";
import { HttpError } from "../http-error";
import { validateBody } from "../validate";
import { requireUser } from "./require-user";

// What the API says about a site. `key` is the public site key that goes in the snippet:
// it can only add events to this one site, never read anything.
export type SiteView = {
  id: string;
  name: string;
  key: string;
  eventCount: number;
  createdAt: string;
  /** browsers per day for the last 14 days (Pakistan time), oldest first; today is the last one */
  daily: number[];
};

type Row = { id: string; name: string; public_key: string; event_count: string; created_at: Date };

const nameSchema = z.object({ name: z.string().trim().min(1, "Give the site a name.").max(60, "Keep the name under 60 characters.") }).strict();
const idSchema = z.string().uuid();
const dailyQuery = z.object({
  days: z.coerce.number().int().refine((n) => [7, 14, 30].includes(n), "days must be 7, 14 or 30").default(14),
  // the last day to show (Pakistan time); today when left out. Tests use it to look at a fixed week.
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must look like 2026-10-21").optional(),
});

export type DailyView = { range: number; today: string; days: { day: string; people: number }[] };

async function dailyFor(tx: Tx, siteId: string): Promise<number[]> {
  const res = await tx.execute<{ people: string }>(sql`
    select people from daily_active(
      ${siteId}::uuid,
      ((now() at time zone 'Asia/Karachi')::date - 13),
      (now() at time zone 'Asia/Karachi')::date
    ) order by day`);
  return res.rows.map((r) => Number(r.people));
}

async function view(tx: Tx, row: Row): Promise<SiteView> {
  return {
    id: row.id,
    name: row.name,
    key: row.public_key,
    eventCount: Number(row.event_count),
    createdAt: new Date(row.created_at).toISOString(),
    daily: await dailyFor(tx, row.id),
  };
}

export function sitesRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireUser(ctx.auth));

  router.get("/", async (req, res, next) => {
    try {
      const sites = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const rows = await tx.execute<Row>(sql`select id, name, public_key, event_count, created_at from sites order by created_at`);
        return Promise.all(rows.rows.map((r) => view(tx, r)));
      });
      res.json({ sites });
    } catch (err) {
      next(err);
    }
  });

  router.post("/", validateBody(nameSchema), async (req, res, next) => {
    try {
      const site = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const count = await tx.execute<{ n: string }>(sql`select count(*) as n from sites`);
        if (Number(count.rows[0]?.n) >= 10) throw new HttpError(409, "You can have up to 10 sites. Remove one first, or ask for more.");
        const rows = await tx.execute<Row>(
          sql`insert into sites (owner_id, name) values (${req.user!.id}, ${req.body.name}) returning id, name, public_key, event_count, created_at`,
        );
        return view(tx, rows.rows[0]!);
      });
      res.status(201).json({ site });
    } catch (err) {
      next(err);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      const site = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const rows = await tx.execute<Row>(sql`select id, name, public_key, event_count, created_at from sites where id = ${id.data}`);
        const row = rows.rows[0];
        // Another owner's site looks exactly like a site that does not exist.
        if (!row) throw new HttpError(404, "That site was not found.");
        return view(tx, row);
      });
      res.json({ site });
    } catch (err) {
      next(err);
    }
  });

  router.patch("/:id", validateBody(nameSchema), async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      const site = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const rows = await tx.execute<Row>(
          sql`update sites set name = ${req.body.name} where id = ${id.data} returning id, name, public_key, event_count, created_at`,
        );
        const row = rows.rows[0];
        if (!row) throw new HttpError(404, "That site was not found.");
        return view(tx, row);
      });
      res.json({ site });
    } catch (err) {
      next(err);
    }
  });

  // Browsers per day, in Pakistan time. The last day is usually today, which is still counting.
  router.get("/:id/daily", async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      const query = dailyQuery.safeParse(req.query);
      if (!query.success) throw new HttpError(400, `The request is not valid: ${query.error.issues[0]?.message ?? "check the values"}`);
      const { days, to } = query.data;

      const view: DailyView = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const found = await tx.execute(sql`select 1 from sites where id = ${id.data}`);
        if (found.rows.length === 0) throw new HttpError(404, "That site was not found.");
        const today = await tx.execute<{ d: string }>(sql`select to_char((now() at time zone 'Asia/Karachi')::date, 'YYYY-MM-DD') as d`);
        const rows = await tx.execute<{ day: string; people: string }>(sql`
          select to_char(d.day, 'YYYY-MM-DD') as day, d.people
          from daily_active(
            ${id.data}::uuid,
            coalesce(${to ?? null}::date, (now() at time zone 'Asia/Karachi')::date) - ${days - 1}::int,
            coalesce(${to ?? null}::date, (now() at time zone 'Asia/Karachi')::date)
          ) d order by d.day`);
        return { range: days, today: today.rows[0]!.d, days: rows.rows.map((r) => ({ day: r.day, people: Number(r.people) })) };
      });
      res.json(view);
    } catch (err) {
      next(err);
    }
  });

  // A new key, and the old one stops working at once.
  router.post("/:id/rotate-key", async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      const key = randomBytes(12).toString("hex");
      const site = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const rows = await tx.execute<Row>(
          sql`update sites set public_key = ${key} where id = ${id.data} returning id, name, public_key, event_count, created_at`,
        );
        const row = rows.rows[0];
        if (!row) throw new HttpError(404, "That site was not found.");
        return view(tx, row);
      });
      res.json({ site });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
