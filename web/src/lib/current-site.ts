import { cookies } from "next/headers";
import { ApiDown, apiFetch } from "./api";
import { SITE_COOKIE, type SiteView } from "./sites";

export async function getSites(): Promise<SiteView[]> {
  const res = await apiFetch("/v1/sites");
  if (!res.ok) throw new ApiDown();
  return ((await res.json()) as { sites: SiteView[] }).sites;
}

/** The site the owner is looking at: the remembered one if it still exists, otherwise their first. */
export async function getCurrentSite(): Promise<{ site: SiteView | null; sites: SiteView[] }> {
  const sites = await getSites();
  const remembered = (await cookies()).get(SITE_COOKIE)?.value;
  return { site: sites.find((s) => s.id === remembered) ?? sites[0] ?? null, sites };
}
