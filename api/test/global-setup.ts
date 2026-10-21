import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startLocalPostgres, type LocalPostgres } from "../src/db/local-postgres";

let pg: LocalPostgres | undefined;

// Starts a real Postgres on this computer, makes sure every migration is applied and the two login
// roles exist, then hands the connection strings to the tests through the environment.
//
// Setting up a brand-new Postgres data folder takes over a minute on Windows, so the folder is kept
// between runs (PULSE_PG_CACHE, default: the temp folder) and only the first run pays for it.
// Every test makes its own owners with random ids, so old data never gets in the way.
export async function setup() {
  const dir = process.env.PULSE_PG_CACHE ?? path.join(os.tmpdir(), "pulse-pg-cache");
  await mkdir(dir, { recursive: true });
  pg = await startLocalPostgres({ dir, port: 54339 });
  process.env.TEST_OWNER_URL = pg.ownerUrl;
  process.env.TEST_APP_URL = pg.appUrl;
  process.env.TEST_INGEST_URL = pg.ingestUrl;
}

export async function teardown() {
  // On Windows the data folder can stay locked for a moment after the server stops; that is harmless.
  await pg?.stop().catch(() => undefined);
}
