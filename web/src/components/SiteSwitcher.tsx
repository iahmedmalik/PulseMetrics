"use client";

import { useRouter } from "next/navigation";
import { setCurrentSite, type SiteView } from "@/lib/sites";

// Which site the Innings, Funnel, Install and Ask pages are showing. Remembered in a cookie.
export function SiteSwitcher({ sites, currentId }: { sites: Pick<SiteView, "id" | "name">[]; currentId: string }) {
  const router = useRouter();
  if (sites.length < 2) return null;
  return (
    <label className="switcher">
      <span className="sr-only">Site</span>
      <select
        value={currentId}
        onChange={(e) => {
          setCurrentSite(e.target.value);
          router.refresh();
        }}
      >
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
