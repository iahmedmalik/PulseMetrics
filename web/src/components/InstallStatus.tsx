"use client";

import { eventLabel } from "@pulse/core";
import Link from "next/link";
import { useEffect, useState } from "react";

type Ev = { id: number; name: string };

// "Is it working yet?" It watches for the first event of the site and says so the moment one arrives.
export function InstallStatus({ siteId, firstEvent }: { siteId: string; firstEvent: Ev | null }) {
  const [event, setEvent] = useState<Ev | null>(firstEvent);

  useEffect(() => {
    if (event) return;
    let stopped = false;
    const timer = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch(`/backend/v1/sites/${siteId}/recent?limit=1`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { events: Ev[] };
        if (!stopped && body.events[0]) setEvent(body.events[0]);
      } catch {
        // the server may be asleep: try again on the next tick
      }
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [siteId, event]);

  // The live region stays put so screen readers announce "It works"; the box inside re-enters when it changes.
  return (
    <div role="status">
      <div className={`status ${event ? "ok" : "waiting"}`} key={event ? "ok" : "waiting"}>
        {event ? (
          <>
            <span className="status-dot done" aria-hidden="true" />
            <div>
              <b>It works.</b> The first event, “{eventLabel(event.name)}”, has arrived. <Link href="/innings">See the innings</Link>.
            </div>
          </>
        ) : (
          <>
            <span className="status-dot" aria-hidden="true" />
            <div>
              <b>Waiting for the first event…</b> Open your app and do the thing you are tracking. This page notices by itself.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
