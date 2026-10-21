import { createApp } from "./app";
import { createAuth } from "./auth";
import { loadConfig } from "./config";
import { createDb, createPool } from "./db/client";

const config = loadConfig();
const { db } = createDb(config.DATABASE_URL_APP);
const ingestPool = createPool(config.DATABASE_URL_INGEST, 3);

createApp({ config, db, ingestPool, auth: createAuth(db, config) }).listen(config.PORT, () => {
  console.log(`PulseMetrics API listening on port ${config.PORT}`);
});
