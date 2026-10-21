import { sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import type { AppContext } from "../app";
import { answerQuestion } from "../ask/ask";
import { asOwner } from "../db/client";
import { HttpError } from "../http-error";
import { validateBody } from "../validate";
import { requireUser } from "./require-user";

// "Ask your data": POST /v1/ask { siteId, question } and GET /v1/ask/status.
// Guard rails, in the order they apply: sign-in, a strict body, the site must be the signed-in owner's,
// a daily limit per owner, a short question, and a model that can only run four read-only reports.

const bodySchema = z
  .object({
    siteId: z.string().uuid("siteId must be a site id"),
    question: z.string().trim().min(1, "Type a question.").max(300, "Keep the question under 300 characters."),
  })
  .strict();

/** Questions used today, per owner, counted in Pakistan time. Kept in memory: a restart gives a fresh day, which is fine for a demo limit. */
const usage = new Map<string, number>();
const dayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());

export function askRouter(ctx: AppContext): Router {
  const router = Router();
  router.use(requireUser(ctx.auth));
  const limit = ctx.ask?.dailyLimit ?? 0;
  const key = (ownerId: string) => `${dayKey()}:${ownerId}`;
  const usedBy = (ownerId: string) => usage.get(key(ownerId)) ?? 0;

  router.get("/status", (req, res) => {
    res.json({ enabled: Boolean(ctx.ask), limit, used: usedBy(req.user!.id) });
  });

  router.post("/", validateBody(bodySchema), async (req, res, next) => {
    try {
      if (!ctx.ask) throw new HttpError(503, "Ask is not set up on this server yet. It needs an Anthropic key in the server settings.");
      const ownerId = req.user!.id;
      const { siteId, question } = req.body as z.infer<typeof bodySchema>;

      // The site must be this owner's own (row-level security hides everyone else's).
      const found = await asOwner(ctx.db, ownerId, (tx) => tx.execute(sql`select 1 from sites where id = ${siteId}`));
      if (found.rows.length === 0) throw new HttpError(404, "That site was not found.");

      if (usedBy(ownerId) >= limit) {
        throw new HttpError(429, `You have used today's ${limit} questions. They reset at midnight Pakistan time.`);
      }
      usage.set(key(ownerId), usedBy(ownerId) + 1);

      let result;
      try {
        result = await answerQuestion(question, ctx.ask.model, { db: ctx.db, ownerId, siteId });
      } catch (err) {
        console.error("Ask failed:", err instanceof Error ? err.message : err);
        throw new HttpError(502, "The assistant could not be reached right now. Try again in a moment.");
      }
      res.json({ ...result, used: usedBy(ownerId), limit });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
