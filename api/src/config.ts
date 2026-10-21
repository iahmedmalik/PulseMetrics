import { z } from "zod";

// Everything the server needs from its environment, checked once at start-up so a missing
// setting stops the server with a clear message instead of failing later on a request.
const schema = z.object({
  DATABASE_URL_APP: z.string().min(1, "DATABASE_URL_APP is not set"),
  DATABASE_URL_INGEST: z.string().min(1, "DATABASE_URL_INGEST is not set"),
  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  CRON_SECRET: z.string().min(16, "CRON_SECRET must be at least 16 characters"),
  WEB_ORIGIN: z.string().url("WEB_ORIGIN must be a full address such as https://pulsemetrics.vercel.app"),
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.string().default("development"),
});

export type Config = z.infer<typeof schema> & { isProduction: boolean };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.message}`).join("\n");
    throw new Error(`The server is not set up correctly:\n${lines}`);
  }
  return { ...parsed.data, WEB_ORIGIN: parsed.data.WEB_ORIGIN.replace(/\/$/, ""), isProduction: parsed.data.NODE_ENV === "production" };
}
