"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

const EXAMPLES = ["Where do people drop off?", "How busy was the last week?", "Which events has this site sent?"];

const REPORT_NAMES: Record<string, string> = {
  list_event_names: "Event names",
  get_funnel: "Funnel report",
  get_daily_active: "Daily active report",
  compare_versions: "A/B comparison",
};

type Answer = { question: string; answer: string; tools: { name: string; ok: boolean }[] };

// The question box on the Ask page. The answer comes from the API, which lets the model use PulseMetrics' own
// reports; the chips under the answer say which ones it used.
export function AskBox({ siteId, siteName, enabled, limit, used: usedAtLoad }: { siteId: string; siteName: string; enabled: boolean; limit: number; used: number }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Answer | null>(null);
  const [used, setUsed] = useState(usedAtLoad);

  if (!enabled) {
    return (
      <div className="card">
        <h2>Coming soon</h2>
        <p className="note">
          Asking questions in plain words isn&apos;t switched on yet. Until it is, the same answers are one click away: where people drop off is on the{" "}
          <Link href="/funnel">Funnel</Link>, and how many come each day is on <Link href="/innings">Innings</Link>.
        </p>
      </div>
    );
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q) {
      setError("Type a question first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/backend/v1/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ siteId, question: q }) });
      const body = (await res.json().catch(() => ({}))) as { answer?: string; tools?: { name: string; ok: boolean }[]; used?: number; error?: string };
      if (res.ok && body.answer) {
        setResult({ question: q, answer: body.answer, tools: body.tools ?? [] });
        if (typeof body.used === "number") setUsed(body.used);
        return;
      }
      if (res.status === 429 && typeof limit === "number") setUsed(limit);
      setError(body.error?.replace(/^The request is not valid[^:]*: /, "") ?? "Could not get an answer. Try again in a moment.");
    } catch {
      setError("Can't reach the server. It may be waking up: try again in a minute.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send(question);
  }

  const left = Math.max(0, limit - used);

  return (
    <div className="ask">
      <form className="card" onSubmit={onSubmit} noValidate>
        <h2>
          Your question <span>about {siteName}</span>
        </h2>
        <label>
          <span className="sr-only">Your question</span>
          <textarea
            name="question"
            rows={3}
            maxLength={300}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="For example: where do people drop off?"
            aria-describedby="ask-count"
          />
        </label>
        <ul className="chips ask-examples" aria-label="Example questions">
          {EXAMPLES.map((example) => (
            <li key={example}>
              <button
                type="button"
                className="chip-btn"
                disabled={busy}
                onClick={() => {
                  setQuestion(example);
                  void send(example);
                }}
              >
                {example}
              </button>
            </li>
          ))}
        </ul>
        <div className="card-actions">
          <span id="ask-count" className="hint">
            {left} of {limit} questions left today
          </span>
          <button type="submit" className="btn primary" disabled={busy || left === 0}>
            {busy ? "Working it out…" : "Ask"}
          </button>
        </div>
        {error && (
          <p className="note bad" role="alert">
            {error}
          </p>
        )}
      </form>

      <div aria-live="polite">
        {result && (
          <div className="card ask-answer" key={result.question + result.answer}>
            <h2>
              Answer <span>{result.question}</span>
            </h2>
            <p className="ask-text">{result.answer}</p>
            {result.tools.length > 0 && (
              <>
                <p className="hint">Worked out from</p>
                <ul className="chips ok ask-tools">
                  {result.tools.map((t, i) => (
                    <li key={i}>
                      {REPORT_NAMES[t.name] ?? t.name}
                      {t.ok ? "" : " (could not run)"}
                    </li>
                  ))}
                </ul>
              </>
            )}
            <p className="hint ask-warn">Check anything important in the Funnel and Innings pages. The answer is written by an AI model from your reports.</p>
          </div>
        )}
      </div>
    </div>
  );
}
