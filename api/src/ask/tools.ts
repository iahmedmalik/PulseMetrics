import { abVerdict, compareProportions, isValidEventName, shapeFunnel, summarize } from "@pulse/core";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { asOwner, type Db } from "../db/client";

// The only things the model can do. Each tool runs one of PulseMetrics' own reports, as the signed-in owner,
// for ONE site that the server chose (the model is never given a site id, so it cannot look at another site).
// The model never writes SQL: it only fills in the few validated inputs below.

export type ToolContext = { db: Db; ownerId: string; siteId: string };

const days = z.coerce.number().int().refine((n) => [7, 14, 30].includes(n), "days must be 7, 14 or 30").default(14);

const funnelInput = z
  .object({
    steps: z
      .array(z.string().refine(isValidEventName, "each step must be a fixed event name such as queue_joined"))
      .min(2, "a funnel needs 2 to 6 steps")
      .max(6, "a funnel needs 2 to 6 steps")
      .refine((a) => new Set(a).size === a.length, "each step must be a different event"),
    days,
  })
  .strict();
const dailyInput = z.object({ days }).strict();
const count = z.coerce.number().int().min(0).max(1_000_000_000);
const compareInput = z.object({ a_visitors: count, a_conversions: count, b_visitors: count, b_conversions: count }).strict();
const namesInput = z.object({}).strict();

// JSON schemas as the Anthropic API wants them. additionalProperties is false everywhere: nothing extra is accepted.
export const TOOL_DEFINITIONS = [
  {
    name: "list_event_names",
    description: "List the kinds of event this site has sent (fixed names like queue_joined), in the order they were first seen. Call this first when you need to know which events exist.",
    input_schema: { type: "object" as const, properties: {}, additionalProperties: false },
  },
  {
    name: "get_funnel",
    description:
      "How many people (browsers) did each step, in order, for 2 to 6 event names. A browser counts at a step only if it did all earlier steps first. Returns people at each step, the share who carried on, the biggest drop, and whether the sample is small.",
    input_schema: {
      type: "object" as const,
      properties: {
        steps: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6, description: "Event names in the order people take them" },
        days: { type: "integer", enum: [7, 14, 30], description: "How many days back, in Pakistan time. Default 14." },
      },
      required: ["steps"],
      additionalProperties: false,
    },
  },
  {
    name: "get_daily_active",
    description: "Active browsers per day for the last 7, 14 or 30 days (Pakistan time), plus today so far, the busiest day and the average of completed days.",
    input_schema: {
      type: "object" as const,
      properties: { days: { type: "integer", enum: [7, 14, 30], description: "How many days back. Default 14." } },
      additionalProperties: false,
    },
  },
  {
    name: "compare_versions",
    description:
      "Compare two versions of something (A and B) with a two-proportion test. Give the number of people who saw each version and how many of them did the thing. Returns both rates, the p-value, and a plain verdict. It never calls a winner unless p is under 0.05 and the sample is big enough.",
    input_schema: {
      type: "object" as const,
      properties: {
        a_visitors: { type: "integer" },
        a_conversions: { type: "integer" },
        b_visitors: { type: "integer" },
        b_conversions: { type: "integer" },
      },
      required: ["a_visitors", "a_conversions", "b_visitors", "b_conversions"],
      additionalProperties: false,
    },
  },
];

export const TOOL_NAMES = TOOL_DEFINITIONS.map((t) => t.name);

export type ToolOutcome = { ok: true; result: unknown } | { ok: false; error: string };

const firstProblem = (e: z.ZodError) => e.issues[0]?.message ?? "the input is not valid";

/** Runs one tool. Never throws: a bad input or a failed report becomes an error the model can read and recover from. */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  try {
    switch (name) {
      case "list_event_names": {
        const parsed = namesInput.safeParse(input ?? {});
        if (!parsed.success) return { ok: false, error: firstProblem(parsed.error) };
        const rows = await asOwner(ctx.db, ctx.ownerId, (tx) =>
          tx.execute<{ name: string; count: string }>(
            sql`select name, count(*) as count from events where site_id = ${ctx.siteId} group by name order by min(created_at), name limit 50`,
          ),
        );
        return { ok: true, result: { events: rows.rows.map((r) => ({ name: r.name, times_sent: Number(r.count) })) } };
      }

      case "get_funnel": {
        const parsed = funnelInput.safeParse(input);
        if (!parsed.success) return { ok: false, error: firstProblem(parsed.error) };
        const { steps, days: d } = parsed.data;
        const rows = await asOwner(ctx.db, ctx.ownerId, (tx) =>
          tx.execute<{ step: number; name: string; people: string }>(sql`
            select step, name, people from funnel(
              ${ctx.siteId}::uuid,
              array[${sql.join(steps.map((n) => sql`${n}::text`), sql`, `)}],
              (((now() at time zone 'Asia/Karachi')::date - ${d - 1}::int)::timestamp at time zone 'Asia/Karachi'),
              (((now() at time zone 'Asia/Karachi')::date + 1)::timestamp at time zone 'Asia/Karachi')
            )`),
        );
        const shape = shapeFunnel(rows.rows.map((r) => ({ step: Number(r.step), name: r.name, people: Number(r.people) })));
        return {
          ok: true,
          result: {
            days: d,
            steps: shape.steps.map((s) => ({ step: s.step, event: s.name, people: s.people, percent_of_previous_step: s.ofPrevious, percent_of_first_step: s.ofFirst, left_before_this_step: s.left })),
            overall_percent: shape.overall,
            biggest_drop: shape.biggestDrop,
            small_sample_warning: shape.smallSample ? "fewer than 30 people started, so percentages are only a rough guide" : null,
          },
        };
      }

      case "get_daily_active": {
        const parsed = dailyInput.safeParse(input ?? {});
        if (!parsed.success) return { ok: false, error: firstProblem(parsed.error) };
        const d = parsed.data.days;
        const out = await asOwner(ctx.db, ctx.ownerId, async (tx) => {
          const today = await tx.execute<{ d: string }>(sql`select to_char((now() at time zone 'Asia/Karachi')::date, 'YYYY-MM-DD') as d`);
          const rows = await tx.execute<{ day: string; people: string }>(sql`
            select to_char(x.day, 'YYYY-MM-DD') as day, x.people from daily_active(
              ${ctx.siteId}::uuid,
              (now() at time zone 'Asia/Karachi')::date - ${d - 1}::int,
              (now() at time zone 'Asia/Karachi')::date
            ) x order by x.day`);
          return { today: today.rows[0]!.d, days: rows.rows.map((r) => ({ day: r.day, people: Number(r.people) })) };
        });
        const s = summarize(out.days, out.today);
        return { ok: true, result: { range_days: d, today: out.today, days: out.days, active_today_so_far: s.today, busiest_day: s.busiest, average_per_completed_day: s.average } };
      }

      case "compare_versions": {
        const parsed = compareInput.safeParse(input);
        if (!parsed.success) return { ok: false, error: firstProblem(parsed.error) };
        const { a_visitors, a_conversions, b_visitors, b_conversions } = parsed.data;
        const a = { visitors: a_visitors, conversions: a_conversions };
        const b = { visitors: b_visitors, conversions: b_conversions };
        const c = compareProportions(a, b);
        return {
          ok: true,
          result: { rate_a_percent: +(c.rateA * 100).toFixed(2), rate_b_percent: +(c.rateB * 100).toFixed(2), difference_points: +(c.difference * 100).toFixed(2), p_value: +c.pValue.toFixed(4), verdict: abVerdict(a, b) },
        };
      }

      default:
        return { ok: false, error: `There is no tool called ${name}. The tools are: ${TOOL_NAMES.join(", ")}.` };
    }
  } catch {
    return { ok: false, error: "That report could not be run right now." };
  }
}
