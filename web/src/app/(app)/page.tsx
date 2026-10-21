import type { Metadata } from "next";
import { NewSiteForm } from "@/components/NewSiteForm";
import { SiteCard } from "@/components/SiteCard";
import { StepsStrip } from "@/components/StepsStrip";
import { OvalArt } from "@/components/art";
import { getSites } from "@/lib/current-site";

export const metadata: Metadata = { title: "Your sites" };

export default async function SitesPage() {
  const sites = await getSites();
  const hasEvents = sites.some((s) => s.eventCount > 0);

  return (
    <section>
      <div className="hero">
        <div>
          <h1>Your sites</h1>
          <p className="sub">Each site gets a key and a snippet. Pick one to see its innings.</p>
        </div>
        <OvalArt sites={sites.map((s) => s.name)} />
      </div>

      <StepsStrip hasSite={sites.length > 0} hasEvents={hasEvents} siteName={sites[0]?.name} />

      <div className="sites">
        {sites.map((site) => (
          <SiteCard key={site.id} site={site} />
        ))}
        <NewSiteForm first={sites.length === 0} />
      </div>
    </section>
  );
}
