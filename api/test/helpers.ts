import { randomBytes } from "node:crypto";
import { Client } from "pg";

// Connection strings for the throwaway local Postgres started by global-setup.ts.
export const urls = {
  owner: () => process.env.TEST_OWNER_URL as string,
  app: () => process.env.TEST_APP_URL as string,
  ingest: () => process.env.TEST_INGEST_URL as string,
};

export async function connect(connectionString: string): Promise<Client> {
  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

/** A fresh id for a test owner, so tests never trip over each other. */
export const newId = (prefix: string) => `${prefix}-${randomBytes(4).toString("hex")}`;

/** A random browser id the way the snippet makes one: 16 to 32 lowercase letters and digits. */
export const newAnon = () => randomBytes(10).toString("hex");

/** Creates an owner account row (as the table owner, so no rules get in the way). */
export async function seedOwner(owner: Client, id: string): Promise<void> {
  await owner.query(`insert into "user" (id, name, email) values ($1, $2, $3) on conflict do nothing`, [
    id,
    id,
    `${id}@test.local`,
  ]);
}

export async function seedSite(owner: Client, ownerId: string, name = "Test site"): Promise<{ id: string; key: string }> {
  const res = await owner.query<{ id: string; public_key: string }>(
    "insert into sites (owner_id, name) values ($1, $2) returning id, public_key",
    [ownerId, name],
  );
  const row = res.rows[0]!;
  return { id: row.id, key: row.public_key };
}

/** Inserts an event straight into the table as the table owner, with a chosen time (for tests of time rules). */
export async function seedEvent(owner: Client, siteId: string, anon: string, name: string, at: Date | string): Promise<void> {
  await owner.query("insert into events (site_id, anon_id, name, created_at) values ($1, $2, $3, $4)", [
    siteId,
    anon,
    name,
    at,
  ]);
}

/**
 * Runs `fn` the way the API does for one signed-in owner: inside a transaction with
 * app.owner_id set. Always rolls back, so a test never changes what the next test sees.
 */
export async function asOwner<T>(app: Client, ownerId: string | null, fn: () => Promise<T>): Promise<T> {
  await app.query("begin");
  try {
    if (ownerId !== null) await app.query("select set_config('app.owner_id', $1, true)", [ownerId]);
    return await fn();
  } finally {
    await app.query("rollback");
  }
}

/** True when the promise fails with a Postgres "permission denied" error. */
export async function denied(promise: Promise<unknown>): Promise<boolean> {
  try {
    await promise;
    return false;
  } catch (err) {
    return /permission denied|row-level security|must be owner/i.test((err as Error).message);
  }
}
