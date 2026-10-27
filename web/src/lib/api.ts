import { cookies } from "next/headers";

// Server-side calls to the API. They carry the visitor's cookies, so the API knows who is asking.
export const API_URL = process.env.API_URL ?? "http://127.0.0.1:4000";

/** The API did not answer in time (on the free plan it sleeps when nobody uses it) or answered with an error. */
export class ApiDown extends Error {
  constructor() {
    super("The API is not answering.");
    this.name = "ApiDown";
  }
}

export type Me = { id: string; name: string; email: string };

export async function apiFetch(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const cookie = (await cookies()).toString();
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...init.headers, cookie },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // Say why in the server log (a timeout, a refused or a reset connection): "not answering" alone hides the cause.
    const cause = (err as { cause?: { code?: string } }).cause?.code ?? (err as Error).name;
    console.error(`API call ${init.method ?? "GET"} ${path} failed: ${cause}`);
    throw new ApiDown();
  }
}

/** The signed-in owner, or null when nobody is signed in. Throws ApiDown when the API cannot be reached. */
export async function getMe(): Promise<Me | null> {
  const res = await apiFetch("/v1/me");
  if (res.status === 401) return null;
  if (!res.ok) throw new ApiDown();
  return (await res.json()) as Me;
}

/** Whether "Ask your data" is switched on, so the menus can mark it "Soon" while it is not. */
export async function askIsOn(): Promise<boolean> {
  try {
    const res = await apiFetch("/v1/ask/status");
    return res.ok && ((await res.json()) as { enabled: boolean }).enabled;
  } catch {
    return false;
  }
}
