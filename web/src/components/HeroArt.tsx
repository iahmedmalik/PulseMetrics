// The heading drawing: bars grow, a red pen trace draws across them, a ball rides the trace to a flag.
// The bars are this site's own browsers per day for the chosen range, so the picture never shows growth
// the numbers don't have. With no events yet the plate stays empty and the ball waits at the start.
// Decoration only (the real chart and its table are below). With reduced motion the ball is shown
// already at the flag (see globals.css).
const LEFT = 20;
const WIDTH = 460;
const BASE = 190;
const TALLEST = 120; // leaves room above the tallest day for the flag

export function HeroArt({ values }: { values: number[] }) {
  const max = Math.max(0, ...values);
  const slot = WIDTH / Math.max(values.length, 1);
  const barW = Math.min(26, slot * 0.7);
  const bars = values.map((v, i) => {
    const h = max > 0 && v > 0 ? Math.max(4, (v / max) * TALLEST) : 0;
    return { x: LEFT + i * slot + (slot - barW) / 2, h, cx: LEFT + i * slot + slot / 2 };
  });
  const points = bars.map((b) => `${b.cx.toFixed(1)} ${(BASE - b.h - 12).toFixed(1)}`);
  const trace = `M${points.join("L")}`;
  const end = bars.at(-1);
  const endY = end ? BASE - end.h - 12 : BASE;

  return (
    <svg className="art" viewBox="0 0 520 220" aria-hidden="true" data-empty={max === 0 || undefined}>
      <g stroke="var(--line)" strokeWidth="2">
        <path d="M20 190H500" />
        <path d="M60 190V150M130 190V130M200 190V110M270 190V90M340 190V70M410 190V50M480 190V30" strokeDasharray="3 7" />
      </g>
      {max === 0 ? (
        <circle className="ball" cx={LEFT + 4} cy={BASE - 12} r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2" />
      ) : (
        <>
          <g fill="var(--bar)" opacity=".85">
            {bars.map((b, i) => (
              <rect key={i} className="bar" style={{ animationDelay: `${i * 70}ms` }} x={b.x} y={BASE - b.h} width={barW} height={b.h} />
            ))}
          </g>
          <path id="hero-trace" className="draw" pathLength={1} d={trace} fill="none" stroke="var(--trace)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <circle className="ball moving" r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2">
            <animateMotion dur="3.4s" begin=".4s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".16 1 .3 1">
              <mpath href="#hero-trace" />
            </animateMotion>
          </circle>
          <circle className="ball still" cx={end!.cx} cy={endY} r="9" fill="var(--acc)" stroke="#fff" strokeWidth="2" />
          <g className="pop" style={{ animationDelay: "2s" }}>
            <path d={`M${end!.cx + 6} ${endY}V${endY - 44}`} stroke="var(--acc-t)" strokeWidth="3" strokeLinecap="round" />
            <path d={`M${end!.cx + 6} ${endY - 42}h30l-8 9 8 9h-30z`} fill="var(--acc)" />
          </g>
        </>
      )}
    </svg>
  );
}
