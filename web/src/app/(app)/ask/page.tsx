import type { Metadata } from "next";
import { AskBox } from "@/components/AskBox";
import { NoSite } from "@/components/NoSite";
import { SiteSwitcher } from "@/components/SiteSwitcher";
import { ApiDown, apiFetch } from "@/lib/api";
import { getCurrentSite } from "@/lib/current-site";
import { FlipText } from "@/components/FlipText";

export const metadata: Metadata = { title: "Ask" };

export default async function AskPage() {
  const { site, sites } = await getCurrentSite();
  if (!site) return <NoSite title="Ask" />;

  const res = await apiFetch("/v1/ask/status");
  if (!res.ok) throw new ApiDown();
  const status = (await res.json()) as { enabled: boolean; limit: number; used: number };

  return (
    <section>
      <div className="hero">
        <div>
          <FlipText text="Ask" />
          <p className="sub">
            {status.enabled
              ? `Ask a question about ${site.name} in plain words. The answer is worked out from your own reports, and you can see which ones it used.`
              : `Soon you will be able to ask about ${site.name} in plain words, with answers worked out from your own reports.`}
          </p>
        </div>
      </div>
      <div className="toolbar">
        <SiteSwitcher sites={sites} currentId={site.id} />
      </div>
      <AskBox key={site.id} siteId={site.id} siteName={site.name} enabled={status.enabled} limit={status.limit} used={status.used} />
    </section>
  );
}
