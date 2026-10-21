import { randomBytes } from "node:crypto";
import type { Page } from "@playwright/test";

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
