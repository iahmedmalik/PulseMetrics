import type { Metadata } from "next";
import Link from "next/link";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { BuildArt } from "@/components/BuildArt";
import { COUNTS, CREDITS, DECISIONS, HONEST_LIMITS, LINKS, PROBLEM, STACK, THE_STORY, WHO_BUILT_IT } from "@/content/howItsBuilt";
import { FlipText } from "@/components/FlipText";

export const metadata: Metadata = { title: "How it's built", description: "Who built PulseMetrics, why, with what, and how it is tested." };

export default function HowItsBuiltPage() {
  return (
    <section>
      <div className="hero">
        <div>
          <FlipText text="How it's built" />
          <p className="sub">Who built it, why, with what, and how it is tested.</p>
        </div>
        <BuildArt />
      </div>

      <div className="prose wide">
        <div className="card">
          <h2>Who built it</h2>
          {WHO_BUILT_IT.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="card">
          <h2>The story</h2>
          {THE_STORY.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>

        <div className="card">
          <h2>The problem</h2>
          <p>{PROBLEM}</p>
        </div>

        <div className="card">
          <h2>The technology</h2>
          <div className="stack-grid">
            {STACK.map((g) => (
              <div key={g.group}>
                <h3>{g.group}</h3>
                <ul className="chips ok">
                  {g.items.map((i) => (
                    <li key={i}>{i}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Architecture</h2>
          <ArchitectureDiagram />
          <p>
            A snippet in someone&apos;s app sends a fixed event name and a random browser id to the API. The API checks it and inserts it through one database
            function. The dashboard asks the same API for reports, and the database only ever shows an owner their own rows.
          </p>
        </div>

        <div className="card">
          <h2>Decisions worth knowing</h2>
          <ul className="decisions">
            {DECISIONS.map((d) => (
              <li key={d.title}>
                <b>{d.title}.</b> {d.text}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Tests</h2>
          <div className="counts">
            <div>
              <span className="num big-n">{COUNTS.coreTests}</span>
              <small>unit tests on the shared logic (events, A/B statistics, funnel, series)</small>
            </div>
            <div>
              <span className="num big-n">{COUNTS.apiTests}</span>
              <small>API and database tests, run against a real Postgres, including a check of what each database role can and cannot do</small>
            </div>
            <div>
              <span className="num big-n">{COUNTS.browserRuns}</span>
              <small>browser test runs in desktop Chrome, a 375 px phone view and Edge, each screen also scanned for accessibility (WCAG 2.2 AA)</small>
            </div>
          </div>
        </div>

        <div className="card">
          <h2>Honest limits</h2>
          <ul>
            {HONEST_LIMITS.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h2>Links</h2>
          <ul className="links">
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
            <li>
              <Link href="/privacy">What it stores and what it never stores</Link>
            </li>
          </ul>
        </div>

        <div className="card">
          <h2>Credits</h2>
          <p>Built with open-source libraries: {CREDITS.libraries.join(", ")}.</p>
          <p>
            Fonts, all under the SIL Open Font License: {CREDITS.fonts.map((f) => `${f.name} (${f.by})`).join(", ")}.
          </p>
        </div>
      </div>
    </section>
  );
}
