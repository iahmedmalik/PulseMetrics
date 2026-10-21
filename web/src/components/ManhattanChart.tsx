"use client";

import { dayLabel, movingAverage, type DayCount } from "@pulse/core";
import { useRef, useState } from "react";

const W = 700;
const H = 290;
const PAD = 14;

// Daily active browsers as a Manhattan chart (one bar per day) with a red pen trace through it
// (the 7-day average). Today is dashed because it is still counting.
export function ManhattanChart({ days, today, siteName }: { days: DayCount[]; today: string; siteName: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const plate = useRef<HTMLDivElement>(null);

  const max = Math.max(5, ...days.map((d) => d.people));
  const slot = (W - PAD * 2) / days.length;
  const barW = Math.max(6, slot * 0.72);
  const bars = days.map((d, i) => {
    const h = (d.people / max) * (H - 40);
    return { ...d, x: PAD + i * slot + (slot - barW) / 2, y: H - h, h, partial: d.day === today };
  });
  const trend = movingAverage(days.map((d) => d.people), 7);
  const trace = trend.map((v, i) => `${i === 0 ? "M" : "L"}${(bars[i]!.x + barW / 2).toFixed(1)},${(H - (v / max) * (H - 40) - 8).toFixed(1)}`).join("");
  const total = days.reduce((n, d) => n + d.people, 0);

  function describe(d: DayCount & { partial: boolean }) {
    return `${dayLabel(d.day)}: ${d.people} ${d.people === 1 ? "browser" : "browsers"}${d.partial ? " so far today" : ""}`;
  }

  function move(e: React.PointerEvent<HTMLDivElement>) {
    const hit = (e.target as Element).closest("[data-i]");
    if (!hit || !plate.current) return setTip(null);
    const box = plate.current.getBoundingClientRect();
    const d = bars[Number(hit.getAttribute("data-i"))]!;
    setTip({ x: e.clientX - box.left + 12, y: e.clientY - box.top - 40, text: describe(d) });
  }

  return (
    <div>
      <div className="paper" ref={plate} onPointerMove={move} onPointerLeave={() => setTip(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Active browsers per day for ${siteName}, ${days.length} days, ${total} browser-days in all. A table follows.`}>
          <g>
            {bars.map((b, i) => (
              <rect
                key={b.day}
                data-i={i}
                className={`bar${b.partial ? " part" : ""}`}
                style={{ animationDelay: `${i * 45}ms` }}
                x={b.x}
                y={b.y}
                width={barW}
                height={Math.max(b.h, b.people > 0 ? 2 : 0)}
              />
            ))}
          </g>
          <path className="draw" pathLength={1} d={trace} fill="none" stroke="var(--trace)" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" style={{ animationDelay: ".7s" }} />
        </svg>
        {tip && (
          <div className="tip" style={{ left: tip.x, top: tip.y }} role="presentation">
            {tip.text}
          </div>
        )}
      </div>
      <div className="leg">
        <span>
          <i /> 7-day trend
        </span>
        <span>
          <i className="d" /> today, still counting
        </span>
        <span>days in Pakistan time</span>
        <button type="button" className="link-btn" aria-pressed={showTable} aria-controls="daily-table" onClick={() => setShowTable((v) => !v)}>
          {showTable ? "Hide the table" : "Show as a table"}
        </button>
      </div>
      <div className="collapse" data-open={showTable} id="daily-table">
        <div inert={!showTable}>
          <table className="data-table">
            <caption className="sr-only">Active browsers per day for {siteName}</caption>
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col" className="r">
                  Browsers
                </th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((d) => (
                <tr key={d.day}>
                  <th scope="row">
                    {dayLabel(d.day)}
                    {d.day === today ? " (so far)" : ""}
                  </th>
                  <td className="r num">{d.people}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
