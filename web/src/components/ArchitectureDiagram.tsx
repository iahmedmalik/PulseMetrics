// How the pieces fit: the snippet in someone's app sends an event to the API, the API writes it to the
// database, and the dashboard (which talks to the same API) reads it back. Lines draw themselves in.
const BOX = { fill: "var(--card2)", stroke: "var(--bar)", strokeWidth: 2.5 } as const;

export function ArchitectureDiagram() {
  return (
    <svg className="arch" viewBox="0 0 760 330" role="img" aria-label="Architecture: a snippet in your app sends events to the API on Render. The API stores them in Postgres on Neon. The dashboard on Vercel reads them through the same API.">
      <defs>
        <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="var(--acc)" />
        </marker>
      </defs>

      <g className="pop">
        <rect x="20" y="30" width="190" height="80" rx="14" {...BOX} />
        <text x="115" y="64" textAnchor="middle" className="arch-t">Your app</text>
        <text x="115" y="88" textAnchor="middle" className="arch-s">1 KB snippet</text>
      </g>
      <g className="pop" style={{ animationDelay: ".25s" }}>
        <rect x="285" y="30" width="190" height="80" rx="14" {...BOX} />
        <text x="380" y="64" textAnchor="middle" className="arch-t">API</text>
        <text x="380" y="88" textAnchor="middle" className="arch-s">Express · Render</text>
      </g>
      <g className="pop" style={{ animationDelay: ".5s" }}>
        <rect x="550" y="30" width="190" height="80" rx="14" {...BOX} />
        <text x="645" y="64" textAnchor="middle" className="arch-t">Postgres</text>
        <text x="645" y="88" textAnchor="middle" className="arch-s">Neon · row-level security</text>
      </g>
      <g className="pop" style={{ animationDelay: ".75s" }}>
        <rect x="285" y="220" width="190" height="80" rx="14" {...BOX} />
        <text x="380" y="254" textAnchor="middle" className="arch-t">Dashboard</text>
        <text x="380" y="278" textAnchor="middle" className="arch-s">Next.js · Vercel</text>
      </g>

      <path className="draw" pathLength={1} d="M210 70H285" fill="none" stroke="var(--acc)" strokeWidth="3" markerEnd="url(#arch-arrow)" style={{ animationDelay: ".9s" }} />
      <path className="draw" pathLength={1} d="M475 70H550" fill="none" stroke="var(--acc)" strokeWidth="3" markerEnd="url(#arch-arrow)" style={{ animationDelay: "1.1s" }} />
      <path className="draw" pathLength={1} d="M380 220V110" fill="none" stroke="var(--trace)" strokeWidth="3" markerEnd="url(#arch-arrow)" style={{ animationDelay: "1.3s" }} />

      <text x="247" y="58" textAnchor="middle" className="arch-s">name + id</text>
      <text x="512" y="58" textAnchor="middle" className="arch-s">insert only</text>
      <text x="392" y="170" className="arch-s">reads, as the signed-in owner</text>
    </svg>
  );
}
