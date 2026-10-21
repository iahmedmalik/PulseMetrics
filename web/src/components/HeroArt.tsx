// The heading drawing: bars grow, a red pen trace draws across them, a ball rides the trace to a flag.
// Decoration only. With reduced motion the ball is shown already at the flag (see globals.css).
const BARS = [40, 60, 50, 85, 75, 110, 100, 130, 125, 95, 115, 105, 120];
const TRACE = "M20 150L57 130L94 140L131 105L168 115L205 80L242 90L279 60L316 66L353 96L390 76L427 88L464 66";

export function HeroArt() {
  return (
    <svg className="art" viewBox="0 0 520 220" aria-hidden="true">
      <g stroke="var(--line)" strokeWidth="2">
        <path d="M20 190H500" />
        <path d="M60 190V150M130 190V130M200 190V110M270 190V90M340 190V70M410 190V50M480 190V30" strokeDasharray="3 7" />
      </g>
      <g fill="var(--bar)" opacity=".85">
        {BARS.map((v, i) => (
          <rect key={i} className="bar" style={{ animationDelay: `${i * 70}ms` }} x={24 + i * 37} y={190 - v} width="26" height={v} />
        ))}
      </g>
      <path id="hero-trace" className="draw" pathLength={1} d={TRACE} fill="none" stroke="var(--trace)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle className="ball moving" r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2">
        <animateMotion dur="3.4s" begin=".4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".16 1 .3 1">
          <mpath href="#hero-trace" />
        </animateMotion>
      </circle>
      <circle className="ball still" cx="464" cy="66" r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2" />
      <g className="pop" style={{ animationDelay: "2s" }}>
        <path d="M470 66V22" stroke="var(--acc-t)" strokeWidth="3" strokeLinecap="round" />
        <path d="M470 24h30l-8 9 8 9h-30z" fill="var(--acc)" />
      </g>
    </svg>
  );
}
