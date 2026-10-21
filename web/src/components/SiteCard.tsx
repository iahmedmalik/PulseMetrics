"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setCurrentSite, shortKey, snippetFor, type SiteView } from "@/lib/sites";
import { Spark } from "./Spark";

export function SiteCard({ site }: { site: SiteView }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [showSnippet, setShowSnippet] = useState(false);
  const [keyOpen, setKeyOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snippet = () => snippetFor(site.key, window.location.origin);
  const today = site.daily.at(-1) ?? 0;

  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(snippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copying can be refused (for example on an insecure address): show the text so it can be selected.
      setShowSnippet(true);
    }
  }

  async function replaceKey() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/backend/v1/sites/${site.id}/rotate-key`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error();
      setConfirming(false);
      router.refresh();
    } catch {
      setError("Could not replace the key. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="card site-card" aria-label={site.name}>
      <h2>
        {site.name}
        {today > 0 ? (
          <span className="live">
            <i /> live today
          </span>
        ) : (
          <span>quiet today</span>
        )}
      </h2>
      <p className="key-line num">
        key {shortKey(site.key)} · {site.eventCount.toLocaleString("en")} {site.eventCount === 1 ? "event" : "events"}
      </p>
      <Spark points={site.daily} label={`Active browsers per day for ${site.name}, last 14 days`} />

      <div className="card-actions">
        <Link className="btn primary" href="/innings" onClick={() => setCurrentSite(site.id)}>
          Open
        </Link>
        <button type="button" className="btn" onClick={copySnippet}>
          {copied ? "Copied" : "Copy snippet"}
        </button>
        <button type="button" className="btn" aria-expanded={keyOpen} aria-controls={`key-${site.id}`} onClick={() => setKeyOpen((v) => !v)}>
          Key
        </button>
      </div>
      <span className="sr-only" aria-live="polite">
        {copied ? "Snippet copied" : ""}
      </span>

      <div className="collapse" data-open={showSnippet} id={`snippet-${site.id}`}>
        <div inert={!showSnippet}>
          <pre className="snippet">{showSnippet ? snippet() : ""}</pre>
        </div>
      </div>

      <div className="collapse" data-open={keyOpen} id={`key-${site.id}`}>
        <div inert={!keyOpen}>
          <div className="key-panel">
            <p className="hint">The site key (it can only add events to this site, never read anything):</p>
            <code className="num key-full">{site.key}</code>
            {confirming ? (
              <div className="note" role="group" aria-label="Replace the key">
                <p>Replace the key? The snippet already on your site stops working at once, until you paste the new one.</p>
                <div className="card-actions">
                  <button type="button" className="btn primary" onClick={replaceKey} disabled={busy}>
                    {busy ? "Replacing…" : "Yes, replace it"}
                  </button>
                  <button type="button" className="btn" onClick={() => setConfirming(false)} disabled={busy}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirming(true)}>
                Replace key
              </button>
            )}
            <div role="alert">{error && <p className="note bad">{error}</p>}</div>
          </div>
        </div>
      </div>
    </article>
  );
}
