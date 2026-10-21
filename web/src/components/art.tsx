// Drawn artwork. Each page has its own: lines draw themselves in, dots pop in, rings spread.
// All of it is decoration (aria-hidden), and the reduced-motion rules in globals.css show it finished.

/** A cricket oval with pulse rings spreading from the pitch and one dot per site. */
export function OvalArt({ sites = ["QueueCare", "CommitteeKeeper"] }: { sites?: string[] }) {
  const spots = [
    { x: 150, y: 80, tx: 136, ty: 64 },
    { x: 372, y: 150, tx: 340, ty: 176 },
  ];
  return (
    <svg className="art" viewBox="0 0 520 220" aria-hidden="true">
      <ellipse className="draw" pathLength={1} cx="260" cy="112" rx="238" ry="96" fill="var(--card)" stroke="var(--line)" strokeWidth="3" />
      <ellipse cx="260" cy="112" rx="205" ry="80" fill="none" stroke="var(--line)" strokeWidth="2" strokeDasharray="4 8" />
      <rect x="248" y="62" width="24" height="100" rx="4" fill="var(--card2)" stroke="var(--chalk)" strokeWidth="2" />
      <path d="M244 72h32M244 152h32" stroke="var(--chalk)" strokeWidth="2" />
      {[0, 1.2, 2.4].map((d) => (
        <circle key={d} className="ring" cx="260" cy="112" r="100" style={{ animationDelay: `${d}s` }} />
      ))}
      {sites.slice(0, spots.length).map((name, i) => {
        const s = spots[i]!;
        return (
          <g key={name} className="pop" style={{ animationDelay: `${0.8 + i * 0.3}s` }}>
            <circle cx={s.x} cy={s.y} r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2" />
            <text x={s.tx} y={s.ty} fill="var(--chalk)" fontSize="13" fontWeight="700" fontFamily="var(--font-text)">
              {name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
