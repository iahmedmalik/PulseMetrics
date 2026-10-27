import type { Metadata } from "next";
import Link from "next/link";
import { NeverStored } from "@/components/NeverStored";
import { ShieldArt } from "@/components/ShieldArt";
import { FlipText } from "@/components/FlipText";

export const metadata: Metadata = { title: "Privacy", description: "What PulseMetrics stores about visitors and owners, what it never stores, and how long it keeps it." };

export default function PrivacyPage() {
  return (
    <section>
      <div className="hero">
        <div>
          <FlipText text="Privacy" />
          <p className="sub">PulseMetrics was built to count what happens in an app without learning who did it. This page says exactly what that means.</p>
          <p className="updated">Last updated 21 October 2026</p>
        </div>
        <ShieldArt />
      </div>

      <div className="prose">
        <div className="card">
          <h2>When a site uses the snippet, a visitor leaves three things</h2>
          <NeverStored heading={false} />
          <p style={{ marginTop: 14 }}>
            The snippet sends a short fixed event name that the site&apos;s owner chose in their code (for example <code className="num">queue_joined</code>), a random
            browser id that the snippet makes itself, and the server records the time it arrived. That is the whole record. The browser id is kept in the
            visitor&apos;s browser storage, not in a cookie, and it is not made from anything about the person.
          </p>
        </div>

        <div className="card">
          <h2>What is never collected</h2>
          <p>
            The snippet never reads the page address, the address bar&apos;s query string, the referrer, the language or the kind of browser. The server refuses
            any event that carries anything else, and event names that look like an address, a token, a name, a phone number or an email are refused before
            anything is saved. This matters because some apps put private links in their addresses; those never reach PulseMetrics.
          </p>
          <p>
            Every request on the internet carries an address for the reply. PulseMetrics does not store it. It is used in memory for a minute to stop one machine
            flooding the service, in a scrambled form that cannot be turned back into the address, and it is forgotten when the server restarts.
          </p>
        </div>

        <div className="card">
          <h2>Do Not Track</h2>
          <p>
            A visitor whose browser says Do Not Track, or Global Privacy Control, is not tracked at all: the snippet does nothing, sends nothing, and writes nothing
            to their browser.
          </p>
        </div>

        <div className="card">
          <h2>Owners</h2>
          <ul>
            <li>
              An owner&apos;s account holds a name, an email address and a password. The password is stored only as a one-way hash, never as text.
            </li>
            <li>The dashboard sets one cookie, to keep an owner signed in. It sets no cookie on visitors of the sites it measures.</li>
            <li>Sign-in does not keep the owner&apos;s IP address in the database. Repeated failed sign-ins from one address are slowed down using a short-lived count kept in the server&apos;s memory.</li>
          </ul>
        </div>

        <div className="card">
          <h2>How long it is kept, and deleting it</h2>
          <ul>
            <li>
              Events older than <b>180 days</b> are deleted automatically, every day.
            </li>
            <li>Each site can hold up to 200,000 events; after that, new events are refused until old ones age out.</li>
            <li>
              An owner can <b>delete a site at any time</b> from the Sites page. That deletes the site and every event it received, immediately and for good.
            </li>
            <li>Deleting an account is not available in this version. Deleting all of an owner&apos;s sites removes all of their event data.</li>
          </ul>
        </div>

        <div className="card">
          <h2>Where it lives</h2>
          <p>
            The database runs on Neon and the server on Render, both in the Singapore region, and the dashboard on Vercel. Nothing is sold, shared with
            advertisers, or combined with data from anywhere else.
          </p>
        </div>

        <p className="hint">
          Questions or concerns: open an issue on the <a href="https://github.com/iahmedmalik/PulseMetrics/issues">project page</a>. Back to <Link href="/how-its-built">how it is built</Link>.
        </p>
      </div>
    </section>
  );
}
