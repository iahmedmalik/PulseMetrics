// The privacy page's drawing: a shield that draws itself, with an address, a key and a mail icon struck out
// and a single small pulse kept inside. Decoration only.
export function ShieldArt() {
  return (
    <svg className="art" viewBox="0 0 520 200" aria-hidden="true">
      <path className="draw" pathLength={1} d="M260 14 L350 44 V104 C350 148 312 176 260 190 C208 176 170 148 170 104 V44 Z" fill="var(--card)" stroke="var(--bar)" strokeWidth="4" />
      <path className="draw" pathLength={1} style={{ animationDelay: ".8s" }} d="M205 108h30l8-26 14 52 11-36 6 10h31" fill="none" stroke="var(--trace)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      {[
        { x: 60, y: 50, t: "/m/…token" },
        { x: 60, y: 100, t: "name" },
        { x: 60, y: 150, t: "email" },
      ].map((c, i) => (
        <g key={c.t} className="pop" style={{ animationDelay: `${1 + i * 0.25}s` }}>
          <rect x={c.x} y={c.y - 16} width="100" height="32" rx="16" fill="none" stroke="var(--line)" strokeWidth="2" />
          <text x={c.x + 50} y={c.y + 5} textAnchor="middle" fill="var(--mute)" fontSize="14" fontFamily="var(--font-mono)">
            {c.t}
          </text>
          <path d={`M${c.x + 10} ${c.y}H${c.x + 90}`} stroke="var(--trace)" strokeWidth="2.5" />
        </g>
      ))}
    </svg>
  );
}
