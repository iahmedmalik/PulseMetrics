// A tiny pen-plotted line for a site card: 14 days of active browsers, drawn in once.
export function Spark({ points, label }: { points: number[]; label: string }) {
  const w = 300;
  const h = 60;
  const max = Math.max(1, ...points);
  const step = w / Math.max(1, points.length - 1);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - 6 - (v / max) * (h - 14)).toFixed(1)}`).join("");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <path className="draw" pathLength={1} d={d} fill="none" stroke="var(--trace)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
