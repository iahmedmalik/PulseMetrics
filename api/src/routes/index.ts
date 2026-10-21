import { Router } from "express";
import type { AppContext } from "../app";
import { requireUser } from "./require-user";

// Every dashboard route lives under /v1 and runs behind requireUser: no session, no answer.
export function createRoutes(ctx: AppContext): Router {
  const router = Router();
  const needUser = requireUser(ctx.auth);

  router.get("/me", needUser, (req, res) => {
    res.json({ id: req.user!.id, name: req.user!.name, email: req.user!.email });
  });

  return router;
}
