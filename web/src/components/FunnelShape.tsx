import { eventLabel, type FunnelShape as Shape } from "@pulse/core";

const W = 860;
const H = 330;
const CY = 125;
const MAX_H = 170;

// The funnel as a channel that narrows from step to step. Red drops fall out where people leave.
// On a phone the same numbers are shown as a vertical list of bars instead (see FunnelBars).
export function FunnelShape({ shape }: { shape: Shape }) {
  const n = shape.steps.length;
  const spacing = n > 1 ? 640 / (n - 1) : 0;
  const half = Math.min(70, spacing * 0.36);
  const xs = shape.steps.map((_, i) => 110 + i * spacing);
  const hs = shape.steps.map((s) => Math.max(6, shape.started > 0 ? (s.people / shape.started) * MAX_H : 0));

  let top = `M${xs[0]! - half},${CY - hs[0]! / 2}`;
  let bottom = "";
  for (let i = 0; i < n; i++) {
    top += ` L${xs[i]! + half},${CY - hs[i]! / 2}`;
    if (i < n - 1) {
      const mx = (xs[i]! + half + xs[i + 1]! - half) / 2;
      top += ` C${mx},${CY - hs[i]! / 2} ${mx},${CY - hs[i + 1]! / 2} ${xs[i + 1]! - half},${CY - hs[i + 1]! / 2}`;
    }
  }
  bottom += ` L${xs[n - 1]! + half},${CY + hs[n - 1]! / 2}`;
  for (let i = n - 1; i >= 0; i--) {
    bottom += ` L${xs[i]! - half},${CY + hs[i]! / 2}`;
    if (i > 0) {
      const mx = (xs[i - 1]! + half + xs[i]! - half) / 2;
      bottom += ` C${mx},${CY + hs[i]! / 2} ${mx},${CY + hs[i - 1]! / 2} ${xs[i - 1]! + half},${CY + hs[i - 1]! / 2}`;
    }
  }

  const short = (name: string) => {
    const label = eventLabel(name);
    return n >= 5 && label.length > 13 ? `${label.slice(0, 12)}…` : label;
  };

  return (
    <svg className="fun" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Funnel: ${shape.steps.map((s) => `${eventLabel(s.name)} ${s.people}`).join(", then ")}.`}>
      <defs>
        <linearGradient id="channel-fill" x1="0" x2="1">
          <stop offset="0" stopColor="var(--bar)" stopOpacity=".85" />
          <stop offset="1" stopColor="var(--bar)" stopOpacity=".3" />
        </linearGradient>
      </defs>
      <path className="channel" d={`${top}${bottom} Z`} />
      {shape.steps.slice(1).map((s, k) => {
        if (s.left <= 0) return null;
        const i = k + 1;
        const drops = Math.min(6, Math.max(1, Math.round((s.left / Math.max(1, shape.started)) * 14)));
        const x0 = xs[i - 1]! + half + 14;
        const x1 = xs[i]! - half - 14;
        const y = CY + (hs[i - 1]! + hs[i]!) / 4 + 2;
        return Array.from({ length: drops }, (_, d) => (
          <circle key={`${i}-${d}`} className="drop" cx={x0 + ((x1 - x0) * (d + 0.5)) / drops} cy={y} r="5" style={{ animationDelay: `${(d * 0.33 + i * 0.1).toFixed(2)}s` }} />
        ));
      })}
      {shape.steps.map((s, i) => (
        <g key={s.step} className="pop" style={{ animationDelay: `${0.15 + i * 0.08}s` }}>
          <text className="flab" x={xs[i]} y={CY + 7} textAnchor="middle">
            {s.people.toLocaleString("en")}
          </text>
          <text className="fsm" x={xs[i]} y={CY - hs[i]! / 2 - 14} textAnchor="middle">
            {short(s.name)}
          </text>
        </g>
      ))}
      {shape.steps.slice(1).map((s, k) => {
        const i = k + 1;
        if (s.left <= 0) return null;
        return (
          <text key={s.step} className="fred pop" style={{ animationDelay: `${0.45 + i * 0.08}s` }} x={(xs[i - 1]! + xs[i]!) / 2} y="312" textAnchor="middle">
            −{s.left.toLocaleString("en")} left{s.ofPrevious !== null ? ` (${100 - s.ofPrevious}%)` : ""}
          </text>
        );
      })}
    </svg>
  );
}

// The phone version: one row per step, the bar showing how much of the start is still there.
export function FunnelBars({ shape }: { shape: Shape }) {
  return (
    <ol className="funnel-bars">
      {shape.steps.map((s, i) => (
        <li key={s.step} style={{ animationDelay: `${i * 80}ms` }}>
          <div className="fb-head">
            <span>{eventLabel(s.name)}</span>
            <b className="num">{s.people.toLocaleString("en")}</b>
          </div>
          <div className="fb-track" aria-hidden="true">
            <i style={{ width: `${Math.max(2, s.ofFirst ?? 0)}%`, animationDelay: `${i * 80 + 150}ms` }} />
          </div>
          {i > 0 && s.left > 0 && (
            <p className="fb-left">
              −{s.left.toLocaleString("en")} left ({100 - (s.ofPrevious ?? 0)}%)
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
