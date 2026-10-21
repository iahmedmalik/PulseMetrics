import express, { type ErrorRequestHandler, type Express } from "express";
import { HttpError } from "./http-error";

export function createApp(): Express {
  const app = express();
  app.disable("x-powered-by");
  // Render sits behind a proxy: trust one hop so the client address is the real one.
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "16kb" }));

  // The pinger calls this every 10 minutes to keep the free Render service awake.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use((_req, _res, next) => next(new HttpError(404, "Not found.")));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    // A body that is not valid JSON or is too large is the client's mistake, not ours.
    if (typeof err?.status === "number" && err.status >= 400 && err.status < 500) {
      res.status(err.status).json({ error: "The request could not be read." });
      return;
    }
    console.error("Unhandled error:", err);
    res.status(500).json({ error: "Something went wrong on our side." });
  };
  app.use(onError);

  return app;
}
