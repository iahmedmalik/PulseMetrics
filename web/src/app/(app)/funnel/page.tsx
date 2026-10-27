import { eventLabel, isValidEventName, shapeFunnel, type FunnelRow } from "@pulse/core";
import type { Metadata } from "next";
import Link from "next/link";
import { Disclosure } from "@/components/Disclosure";
import { FunnelArt } from "@/components/FunnelArt";
import { FunnelBars, FunnelShape } from "@/components/FunnelShape";
import { NoSite } from "@/components/NoSite";
import { parseRange, RangeTabs } from "@/components/RangeTabs";
import { SiteSwitcher } from "@/components/SiteSwitcher";
import { StepsPicker } from "@/components/StepsPicker";
import { ApiDown, apiFetch } from "@/lib/api";
import { getCurrentSite } from "@/lib/current-site";
import { FlipText } from "@/components/FlipText";

export const metadata: Metadata = { title: "Funnel" };

type Names = { names: { name: string; count: number }[] };

function stepsFromAddress(value: string | undefined): string[] | null {
  if (!value) return null;
  const steps = value.split(",").map((s) => s.trim());
  const ok = steps.length >= 2 && steps.length <= 6 && new Set(steps).size === steps.length && steps.every(isValidEventName);
  return ok ? steps : null;
}

export default async function FunnelPage({ searchParams }: { searchParams: Promise<{ range?: string; steps?: string }> }) {
  const query = await searchParams;
  const range = parseRange(query.range);
  const { site, sites } = await getCurrentSite();
  if (!site) return <NoSite title="Funnel" />;

  const namesRes = await apiFetch(`/v1/sites/${site.id}/names`);
  if (!namesRes.ok) throw new ApiDown();
  const names = ((await namesRes.json()) as Names).names.map((n) => n.name);

  const fromAddress = stepsFromAddress(query.steps);
  const steps = fromAddress ?? names.slice(0, Math.min(3, names.length));

  const head = (
    <>
      <div className="hero">
        <div>
          <FlipText text="Funnel" />
          <p className="sub">Who walks on, and who leaves at each step. Steps count people, in order, in the last {range} days.</p>
        </div>
        <FunnelArt />
      </div>
      <div className="toolbar">
        <SiteSwitcher sites={sites} currentId={site.id} />
        <RangeTabs current={range} basePath="/funnel" keep={{ steps: fromAddress?.join(",") }} />
      </div>
    </>
  );

  if (steps.length < 2) {
    return (
      <section>
        {head}
        <div className="card">
          <p className="note">
            A funnel needs at least two kinds of event, and {site.name} has sent {names.length === 0 ? "none" : "one"} so far.{" "}
            <Link href="/install">See how to send events</Link>.
          </p>
        </div>
      </section>
    );
  }

  const res = await apiFetch(`/v1/sites/${site.id}/funnel?steps=${encodeURIComponent(steps.join(","))}&days=${range}`);
  if (!res.ok) throw new ApiDown();
  const rows = ((await res.json()) as { steps: FunnelRow[] }).steps;
  const shape = shapeFunnel(rows);
  const last = shape.steps.at(-1)!;
  const first = shape.steps[0]!;

  return (
    <section>
      {head}
      <StepsPicker key={steps.join(",")} names={names} selected={steps} range={range} />

      <div className="card funnel-card">
        <h2>
          {eventLabel(first.name)} to {eventLabel(last.name)} <span>{range} days · {shape.started.toLocaleString("en")} at step 1</span>
        </h2>

        {shape.started === 0 ? (
          <p className="note">Nobody did “{eventLabel(first.name)}” in these {range} days, so there is no funnel to draw yet.</p>
        ) : (
          <>
            <div className="funnel-wide">
              <FunnelShape shape={shape} />
            </div>
            <div className="funnel-narrow">
              <FunnelBars shape={shape} />
            </div>

            <div className="say">
              {shape.biggestDrop && (
                <p>
                  <b>The biggest drop:</b> between {eventLabel(shape.biggestDrop.fromName)} and {eventLabel(shape.biggestDrop.toName)}.{" "}
                  {shape.biggestDrop.left.toLocaleString("en")} {shape.biggestDrop.left === 1 ? "person" : "people"} ({shape.biggestDrop.percentOfPrevious}% of
                  those who reached {eventLabel(shape.biggestDrop.fromName)}) did not go on.
                </p>
              )}
              <p>
                {shape.overall}% of the {shape.started.toLocaleString("en")} {shape.started === 1 ? "person" : "people"} who started got all the way to {eventLabel(last.name)}.
              </p>
              {shape.smallSample && (
                <p className="note">Only {shape.started} {shape.started === 1 ? "person" : "people"} started here. With so few, treat the percentages as a rough guide, not a result.</p>
              )}
            </div>

            <Disclosure closedLabel="Show as a table" openLabel="Hide the table">
              <table className="data-table">
                <caption className="sr-only">People at each step of the funnel</caption>
                <thead>
                  <tr>
                    <th scope="col">Step</th>
                    <th scope="col" className="r">People</th>
                    <th scope="col" className="r">Of previous step</th>
                    <th scope="col" className="r">Of first step</th>
                    <th scope="col" className="r">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {shape.steps.map((s) => (
                    <tr key={s.step}>
                      <th scope="row">
                        {s.step}. {eventLabel(s.name)}
                      </th>
                      <td className="r num">{s.people.toLocaleString("en")}</td>
                      <td className="r num">{s.ofPrevious === null ? "–" : `${s.ofPrevious}%`}</td>
                      <td className="r num">{s.ofFirst === null ? "–" : `${s.ofFirst}%`}</td>
                      <td className="r num">{s.left === 0 ? "–" : s.left.toLocaleString("en")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Disclosure>
          </>
        )}
      </div>
    </section>
  );
}
