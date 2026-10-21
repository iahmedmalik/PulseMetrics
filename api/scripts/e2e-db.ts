import os from "node:os";
import path from "node:path";
import { startLocalPostgres } from "../src/db/local-postgres";

// The database for the browser tests: a real local Postgres on port 54349 with every migration applied
// and the two login roles created. Playwright starts this, waits for the port, and stops it afterwards.
const dir = process.env.PULSE_PG_CACHE_E2E ?? path.join(os.tmpdir(), "pulse-pg-e2e");
const pg = await startLocalPostgres({ dir, port: 54349 });
console.log("e2e database ready");

const stop = async () => {
  await pg.stop().catch(() => undefined);
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => undefined, 60_000);
