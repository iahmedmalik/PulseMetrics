import { isValidEventName } from "@pulse/core";
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

const funnelQuery = z.object({
  steps: z
    .string()
    .transform((v) => v.split(",").map((x) => x.trim()))
    .pipe(
      z
        .array(z.string().refine(isValidEventName, "each step must be a fixed event name such as queue_joined"))
        .min(2, "A funnel needs 2 to 6 steps.")
        .max(6, "A funnel needs 2 to 6 steps.")
        .refine((a) => new Set(a).size === a.length, "Each step must be a different event."),
    ),
  days: z.coerce.number().int().refine((n) => [7, 14, 30].includes(n), "days must be 7, 14 or 30").default(14),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must look like 2026-10-21").optional(),
});

export type FunnelView = { range: number; steps: { step: number; name: string; people: number }[] };
export type RecentView = { events: { id: number; name: string; browser: string; at: string }[] };
export type NamesView = { names: { name: string; count: number; firstSeen: string }[] };
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

  // How many people got to each step, in order, in the last 7, 14 or 30 days (Pakistan time).
  router.get("/:id/funnel", async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      const query = funnelQuery.safeParse(req.query);
      if (!query.success) throw new HttpError(400, `The request is not valid: ${query.error.issues[0]?.message ?? "check the values"}`);
      const { steps, days, to } = query.data;

      const view: FunnelView = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const found = await tx.execute(sql`select 1 from sites where id = ${id.data}`);
        if (found.rows.length === 0) throw new HttpError(404, "That site was not found.");
        const lastDay = sql`coalesce(${to ?? null}::date, (now() at time zone 'Asia/Karachi')::date)`;
        const stepList = sql`array[${sql.join(steps.map((n) => sql`${n}::text`), sql`, `)}]`;
        const rows = await tx.execute<{ step: number; name: string; people: string }>(sql`
          select step, name, people from funnel(
            ${id.data}::uuid,
            ${stepList},
            ((${lastDay} - ${days - 1}::int)::timestamp at time zone 'Asia/Karachi'),
            ((${lastDay} + 1)::timestamp at time zone 'Asia/Karachi')
          )`);
        return { range: days, steps: rows.rows.map((r) => ({ step: Number(r.step), name: r.name, people: Number(r.people) })) };
      });
      res.json(view);
    } catch (err) {
      next(err);
    }
  });

  // The latest events, newest first. A browser shows as its first 4 characters only: enough to tell two visitors apart, not to follow one.
  router.get("/:id/recent", async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      const limit = z.coerce.number().int().min(1).max(50).default(10).safeParse(req.query.limit);
      if (!limit.success) throw new HttpError(400, "The request is not valid: limit must be from 1 to 50");
      const view: RecentView = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const found = await tx.execute(sql`select 1 from sites where id = ${id.data}`);
        if (found.rows.length === 0) throw new HttpError(404, "That site was not found.");
        const rows = await tx.execute<{ id: string; name: string; browser: string; created_at: Date }>(
          sql`select id, name, left(anon_id, 4) as browser, created_at from events where site_id = ${id.data} order by id desc limit ${limit.data}`,
        );
        return { events: rows.rows.map((r) => ({ id: Number(r.id), name: r.name, browser: r.browser, at: new Date(r.created_at).toISOString() })) };
      });
      res.set("Cache-Control", "no-store").json(view);
    } catch (err) {
      next(err);
    }
  });

  // The kinds of event this site has sent, in the order they were first seen: a good guess at the order of a journey.
  router.get("/:id/names", async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      const view: NamesView = await asOwner(ctx.db, req.user!.id, async (tx) => {
        const found = await tx.execute(sql`select 1 from sites where id = ${id.data}`);
        if (found.rows.length === 0) throw new HttpError(404, "That site was not found.");
        const rows = await tx.execute<{ name: string; count: string; first_seen: Date }>(
          sql`select name, count(*) as count, min(created_at) as first_seen from events where site_id = ${id.data} group by name order by min(created_at), name limit 50`,
        );
        return { names: rows.rows.map((r) => ({ name: r.name, count: Number(r.count), firstSeen: new Date(r.first_seen).toISOString() })) };
      });
      res.json(view);
    } catch (err) {
      next(err);
    }
  });

  // Deletes the site and every event it ever received (the events go with it). It cannot be undone.
  router.delete("/:id", async (req, res, next) => {
    try {
      const id = idSchema.safeParse(req.params.id);
      if (!id.success) throw new HttpError(404, "That site was not found.");
      await asOwner(ctx.db, req.user!.id, async (tx) => {
        const rows = await tx.execute(sql`delete from sites where id = ${id.data} returning id`);
        if (rows.rows.length === 0) throw new HttpError(404, "That site was not found.");
      });
      res.status(204).end();
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
