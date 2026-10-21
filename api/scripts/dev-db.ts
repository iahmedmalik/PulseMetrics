import path from "node:path";
import { startLocalPostgres } from "../src/db/local-postgres";

// Starts a real Postgres on this computer for development (data kept in api/.pgdata), applies every
// migration and creates the two login roles. Leave it running; press Ctrl+C to stop it.
const port = Number(process.env.DEV_DB_PORT ?? 5433);
const pg = await startLocalPostgres({ dir: path.resolve(process.cwd(), ".pgdata"), port });

console.log(`Local Postgres is running on port ${port}. Migrations applied, roles created.`);
console.log("Copy api/.env.example to api/.env.local to use it. Press Ctrl+C to stop.");

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => undefined, 60_000);
