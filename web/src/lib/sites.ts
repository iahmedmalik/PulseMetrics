// What the dashboard knows about a site (this mirrors what the API sends).
export type SiteView = {
  id: string;
  name: string;
  /** the public site key that goes in the snippet; it can only add events to this one site */
  key: string;
  eventCount: number;
  createdAt: string;
  /** browsers per day for the last 14 days (Pakistan time), oldest first; today is last */
  daily: number[];
};

/** The cookie that remembers which site the Innings, Funnel, Install and Ask pages are showing. */
export const SITE_COOKIE = "pm_site";

/** Where the snippet sends events. Set NEXT_PUBLIC_API_URL when the dashboard is built. */
export const API_PUBLIC_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000";

/** The two lines an owner pastes: the script tag, and the call for each event. */
export function snippetFor(key: string, dashboardOrigin: string): string {
  return `<script src="${dashboardOrigin}/p.js" data-key="${key}" data-api="${API_PUBLIC_URL}" async></script>`;
}

/** 7f3a0c91e2b44a7d9c1e0b5f becomes 7f3a…0b5f */
export function shortKey(key: string): string {
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

export function setCurrentSite(id: string): void {
  document.cookie = `${SITE_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
}
