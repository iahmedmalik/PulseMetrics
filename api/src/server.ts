import { createApp } from "./app";
import { createAuth } from "./auth";
import { loadConfig } from "./config";
import { createAnthropicModel } from "./ask/model";
import { createDb, createPool } from "./db/client";

const config = loadConfig();
const { db } = createDb(config.DATABASE_URL_APP);
const ingestPool = createPool(config.DATABASE_URL_INGEST, 3);

const ask = config.ANTHROPIC_API_KEY ? { model: createAnthropicModel(config.ANTHROPIC_API_KEY, config.ASK_MODEL), dailyLimit: config.ASK_DAILY_LIMIT ?? 20 } : undefined;

createApp({ config, db, ingestPool, auth: createAuth(db, config), ask }).listen(config.PORT, () => {
  console.log(`PulseMetrics API listening on port ${config.PORT}`);
});
