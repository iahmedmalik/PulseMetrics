import { dayLabel, summarize } from "@pulse/core";
import type { Metadata } from "next";
import Link from "next/link";
import { HeroArt } from "@/components/HeroArt";
import { LiveEvents } from "@/components/LiveEvents";
import { ManhattanChart } from "@/components/ManhattanChart";
import { NoSite } from "@/components/NoSite";
import { parseRange, RangeTabs } from "@/components/RangeTabs";
import { RollingNumber } from "@/components/RollingNumber";
import { SiteSwitcher } from "@/components/SiteSwitcher";
import { ApiDown, apiFetch } from "@/lib/api";
import { getCurrentSite } from "@/lib/current-site";
import { FlipText } from "@/components/FlipText";

export const metadata: Metadata = { title: "Innings" };

type Daily = { range: number; today: string; days: { day: string; people: number }[] };

export default async function InningsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = parseRange((await searchParams).range);
  const { site, sites } = await getCurrentSite();
  if (!site) return <NoSite title="Innings" />;

  const res = await apiFetch(`/v1/sites/${site.id}/daily?days=${range}`);
  if (!res.ok) throw new ApiDown();
  const daily = (await res.json()) as Daily;
  const recentRes = await apiFetch(`/v1/sites/${site.id}/recent`);
  const recent = recentRes.ok ? ((await recentRes.json()) as { events: { id: number; name: string; browser: string; at: string }[] }).events : [];
  const s = summarize(daily.days, daily.today);

  return (
    <section>
      <div className="hero">
        <div>
          <FlipText text={site.name} />
          <p className="sub">
            {s.hasData && s.busiest
              ? `Busiest day: ${dayLabel(s.busiest.day)}, with ${s.busiest.people} ${s.busiest.people === 1 ? "browser" : "browsers"}. So far today: ${s.today}.`
              : "Nothing has arrived yet. Paste the snippet into your app and the first events will show up here."}
          </p>
        </div>
        <HeroArt />
      </div>

      <div className="toolbar">
        <SiteSwitcher sites={sites} currentId={site.id} />
        <RangeTabs current={range} basePath="/innings" />
      </div>

      <div className="board" aria-label="Scoreboard">
        <div className="cell">
          <small>Active today</small>
          <RollingNumber value={s.today} />
          <em>still counting</em>
        </div>
        <div className="cell">
          <small>Busiest day</small>
          {s.busiest ? <RollingNumber value={s.busiest.people} /> : <RollingNumber value="–" />}
          <em>{s.busiest ? dayLabel(s.busiest.day) : "no events yet"}</em>
        </div>
        <div className="cell">
          <small>Daily average</small>
          <RollingNumber value={s.average} />
          <em>completed days in range</em>
        </div>
        <div className="cell">
          <small>Events, all time</small>
          <RollingNumber value={site.eventCount} />
          <em>since the site was made</em>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <h2>
            Daily active browsers <span>{range} days</span>
          </h2>
          {s.hasData ? (
            <ManhattanChart days={daily.days} today={daily.today} siteName={site.name} />
          ) : (
            <p className="note">
              No events in these {range} days. <Link href="/install">Install the snippet</Link> and they will appear here.
            </p>
          )}
        </div>
        <LiveEvents key={site.id} siteId={site.id} initial={recent} />
      </div>
    </section>
  );
}
