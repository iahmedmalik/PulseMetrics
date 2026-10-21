"use client";

import { timeAgo } from "@pulse/core";
import { useEffect, useState } from "react";

type Ev = { id: number; name: string; browser: string; at: string };

const EVERY_MS = 4000;

// The latest events, newest first. It asks the API every few seconds and stops asking while the tab is
// hidden. Each row is keyed by its event, so a new event is a new row, and a new row slides in.
// Only fixed event names and the first 4 characters of a random browser id are ever shown.
export function LiveEvents({ siteId, initial }: { siteId: string; initial: Ev[] }) {
  const [events, setEvents] = useState<Ev[]>(initial);
  const [now, setNow] = useState(() => Date.now());
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      if (document.hidden) return;
      try {
        const res = await fetch(`/backend/v1/sites/${siteId}/recent`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const body = (await res.json()) as { events: Ev[] };
        if (stopped) return;
        setEvents(body.events);
        setFailed(false);
      } catch {
        if (!stopped) setFailed(true);
      }
    }

    const timer = setInterval(poll, EVERY_MS);
    const onVisible = () => {
      if (!document.hidden) void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [siteId]);

  // the "2 min ago" labels keep counting between polls
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card live-card">
      <h2>
        Events arriving{" "}
        <span className="live">
          <i /> live
        </span>
      </h2>
      {events.length === 0 ? (
        <p className="hint">Nothing yet. The first event appears here within a few seconds of arriving.</p>
      ) : (
        <ul className="tick" aria-label="Latest events">
          {events.map((e) => (
            <li key={e.id}>
              <span className="dot" aria-hidden="true" />
              <span className="num">{e.name}</span>
              <small>
                browser {e.browser}… · {timeAgo(e.at, new Date(now))}
              </small>
            </li>
          ))}
        </ul>
      )}
      {failed && <p className="hint">Could not reach the server just now. Trying again.</p>}
    </div>
  );
}
