import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { CopyBlock } from "@/components/CopyBlock";
import { Disclosure } from "@/components/Disclosure";
import { InstallStatus } from "@/components/InstallStatus";
import { NeverStored } from "@/components/NeverStored";
import { NoSite } from "@/components/NoSite";
import { PipelineArt } from "@/components/PipelineArt";
import { SiteSwitcher } from "@/components/SiteSwitcher";
import { apiFetch } from "@/lib/api";
import { getCurrentSite } from "@/lib/current-site";
import { snippetFor } from "@/lib/sites";
import { FlipText } from "@/components/FlipText";

export const metadata: Metadata = { title: "Install" };

/** The address this dashboard is reached at, so the snippet points at its own copy of p.js. */
async function ownOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3400";
  const local = host.startsWith("localhost") || host.startsWith("127.");
  return `${h.get("x-forwarded-proto") ?? (local ? "http" : "https")}://${host}`;
}

const STUB = `<!-- optional: put this before the snippet if your code calls pulse.track before the page has finished loading -->
<script>window.pulse=window.pulse||{q:[],track:function(n){this.q.push(n)}}</script>`;

export default async function InstallPage() {
  const { site, sites } = await getCurrentSite();
  if (!site) return <NoSite title="Install" />;

  const recentRes = await apiFetch(`/v1/sites/${site.id}/recent?limit=1`);
  const first = recentRes.ok ? (((await recentRes.json()) as { events: { id: number; name: string }[] }).events[0] ?? null) : null;
  const snippet = snippetFor(site.key, await ownOrigin());

  return (
    <section>
      <div className="hero">
        <div>
          <FlipText text="Install" />
          <p className="sub">One script tag, then one line per event. Named events only: nothing about the visitor leaves their browser.</p>
        </div>
        <PipelineArt />
      </div>

      <div className="toolbar">
        <SiteSwitcher sites={sites} currentId={site.id} />
        <span className="hint">
          Installing for <b>{site.name}</b>
        </span>
      </div>

      <div className="install-grid">
        <div className="card">
          <h2>
            1. Paste this once <span>in your page</span>
          </h2>
          <CopyBlock code={snippet} label="The snippet" />
          <p className="hint">Put it in the head or at the end of the body of every page you want to count. It is under 1 KB and never blocks your page.</p>
        </div>

        <div className="card">
          <h2>
            2. Send an event <span>where it happens</span>
          </h2>
          <CopyBlock code={'pulse.track("queue_joined");'} label="An event call" />
          <p className="hint">Use a short fixed name for each step you care about, for example the moment someone joins a queue.</p>
          <Disclosure closedLabel="Calling it before the page has loaded?" openLabel="Hide this">
            <CopyBlock code={STUB} label="The early-call helper" />
          </Disclosure>
        </div>

        <div className="card">
          <h2>
            3. Check it works <span>this page watches for you</span>
          </h2>
          <InstallStatus siteId={site.id} firstEvent={first} />
        </div>

        <div className="card">
          <h2>
            Naming events <span>fixed names only</span>
          </h2>
          <ul className="rules">
            <li>
              <b>Good:</b> <code className="num">queue_joined</code> <code className="num">payment_recorded</code> <code className="num">member_link_opened</code>
            </li>
            <li>
              <b>Not accepted:</b> a page address, an id or token, a name, an email or a phone number. They are refused before anything is saved.
            </li>
            <li>Lowercase words joined by underscores, starting with a letter, 2 to 40 characters.</li>
          </ul>
        </div>

        <div className="card install-wide">
          <NeverStored />
          <p className="hint">
            Visitors who have Do Not Track switched on are never tracked, and nothing is stored in their browser. Read the full <Link href="/privacy">privacy page</Link>.
          </p>
        </div>
      </div>
    </section>
  );
}
