import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";
import { Client } from "pg";

export const PASSWORD = "a-long-enough-password";
export const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3420";

export const uniqueEmail = (prefix = "owner") => `${prefix}-${randomBytes(4).toString("hex")}@example.com`;

/**
 * Makes a new owner account and leaves the page signed in. Setup only: it talks to the API directly
 * (the same call the sign-up form makes) so tests that are about something else stay fast.
 * Tests about signing up itself click through the real form instead.
 */
export async function signUpViaApi(page: Page, name = "Test Owner"): Promise<{ email: string; password: string }> {
  const email = uniqueEmail();
  const res = await page.request.post("/backend/v1/auth/sign-up/email", {
    data: { name, email, password: PASSWORD },
    headers: { Origin: new URL(BASE).origin },
  });
  if (!res.ok()) throw new Error(`Could not create a test account: ${res.status()} ${await res.text()}`);
  return { email, password: PASSWORD };
}

/** Makes a site for the signed-in owner through the API and returns it. */
export async function createSiteViaApi(page: Page, name = "QueueCare"): Promise<{ id: string; key: string; name: string }> {
  const res = await page.request.post("/backend/v1/sites", { data: { name }, headers: { Origin: new URL(BASE).origin } });
  if (!res.ok()) throw new Error(`Could not create a test site: ${res.status()} ${await res.text()}`);
  return (await res.json()).site;
}

// ---- direct database access, for setup and for checks that a screen cannot show ----
// Only possible when the whole stack runs on this computer (see playwright.config.ts).
export const LOCAL_ONLY = !process.env.E2E_BASE_URL;
const DB = "127.0.0.1:54349/pulse";

/** Connects as the table owner, to put data in place the same way the app would. */
export async function ownerDb(): Promise<Client> {
  const client = new Client({ connectionString: `postgres://postgres:owner_local@${DB}` });
  await client.connect();
  return client;
}

/** Connects as the public tracking role, exactly like POST /v1/track does. */
export async function ingestDb(): Promise<Client> {
  const client = new Client({ connectionString: `postgres://pm_ingest:pm_ingest_local@${DB}` });
  await client.connect();
  return client;
}

/** A random browser id the way the snippet makes one. */
export const anonId = () => randomBytes(10).toString("hex");
