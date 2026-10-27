"use client";

import { abVerdict, compareProportions, type Verdict } from "@pulse/core";
import { useState } from "react";

type Fields = { av: string; ac: string; bv: string; bc: string };

const EXAMPLES: { label: string; fields: Fields }[] = [
  { label: "Could be luck", fields: { av: "1000", ac: "100", bv: "1000", bc: "120" } },
  { label: "A clear difference", fields: { av: "500", ac: "50", bv: "500", bc: "80" } },
  { label: "Too few people", fields: { av: "10", ac: "3", bv: "10", bc: "9" } },
];

// A count stays incomplete when blank, and invalid input is never silently changed.
const whole = (s: string): number | null => {
  const value = s.trim();
  if (!/^\d+$/.test(value)) return null;
  const n = Number(value);
  return Number.isSafeInteger(n) ? n : null;
};
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const showP = (p: number) => (p < 0.001 ? "< 0.001" : p.toFixed(3));

function verdictText(v: Verdict, p: number, diff: number): { tone: "good" | "warn" | "none"; head: string; body: string } {
  switch (v.kind) {
    case "no_data":
      return { tone: "none", head: "Enter the numbers.", body: "How many people saw each version, and how many of them did the thing." };
    case "small_sample":
      return {
        tone: "warn",
        head: "Too few people to trust.",
        body: "At least one version has fewer than 5 people who did it, or fewer than 5 who did not. A result from numbers this small is mostly luck. Wait for more people.",
      };
    case "different":
      return {
        tone: "good",
        head: `${v.better} is genuinely different.`,
        body: `A gap this big would show up by luck alone less than 1 time in 20 (p = ${showP(p)}). That says the difference is probably real. It does not say how big or how important it is.`,
      };
    case "not_enough_evidence":
      return {
        tone: "warn",
        head: "Not enough evidence yet.",
        body: `The gap of ${Math.abs(diff * 100).toFixed(1)} points could easily be luck at this size. The p-value is how often luck alone gives a gap this big. It is not the chance that one version is better.`,
      };
  }
}

// The bell curve: how likely each size of gap is when there is really no difference. The red tails are the
// gaps at least as big as the one you measured, in either direction. Their share of the whole is the p-value.
function Bell({ z }: { z: number }) {
  const zz = Math.min(Math.abs(z), 4);
  const X = (x: number) => 200 + x * 45;
  const Y = (y: number) => 100 - y * 88;
  const density = (x: number) => Math.exp((-x * x) / 2);
  const path = (from: number, to: number, close: boolean) => {
    let d = "";
    for (let x = from; x <= to + 0.001; x += 0.1) d += `${d ? "L" : "M"}${X(x).toFixed(1)},${Y(density(x)).toFixed(1)}`;
    return close ? `${d}L${X(to)},${Y(0)}L${X(from)},${Y(0)}Z` : d;
  };
  return (
    <svg className="bell" viewBox="0 0 400 110" role="img" aria-label="A bell curve of gaps that luck alone can produce. The red tails are gaps as big as yours or bigger.">
      <path className="tail" d={path(zz, 4, true)} />
      <path className="tail" d={path(-4, -zz, true)} />
      <path className="curve" d={path(-4, 4, false)} fill="none" />
      <path d={`M${X(0)},${Y(0)}V${Y(1)}`} stroke="var(--line)" strokeDasharray="3 5" />
    </svg>
  );
}

export function AbCalculator() {
  const [f, setF] = useState<Fields>({ av: "", ac: "", bv: "", bc: "" });
  const set = (key: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [key]: e.target.value });

  const counts = { av: whole(f.av), ac: whole(f.ac), bv: whole(f.bv), bc: whole(f.bc) };
  const errors: Partial<Record<keyof Fields, string>> = {};
  for (const key of Object.keys(f) as (keyof Fields)[]) {
    if (f[key].trim() && counts[key] === null) {
      errors[key] = /^\d+$/.test(f[key].trim()) ? "That count is too large to calculate reliably." : "Enter a whole number of people, zero or more.";
    }
  }
  if (counts.av !== null && counts.ac !== null && counts.ac > counts.av) errors.ac = "That is more than the people who saw A. Reduce this count.";
  if (counts.bv !== null && counts.bc !== null && counts.bc > counts.bv) errors.bc = "That is more than the people who saw B. Reduce this count.";
  const hasErrors = Object.keys(errors).length > 0;
  const complete = !hasErrors && Object.values(counts).every((n) => n !== null);
  const a = { visitors: complete ? counts.av! : 0, conversions: complete ? counts.ac! : 0 };
  const b = { visitors: complete ? counts.bv! : 0, conversions: complete ? counts.bc! : 0 };
  const cmp = compareProportions(a, b);
  const verdict = abVerdict(a, b);
  const text = hasErrors
    ? { tone: "warn", head: "Fix the counts.", body: "Check the highlighted fields. Results appear once all four counts are complete and valid." }
    : verdictText(verdict, cmp.pValue, cmp.difference);
  const hasData = complete && a.visitors > 0 && b.visitors > 0;
  const scale = Math.max(cmp.rateA, cmp.rateB, 0.01);

  return (
    <div className="ab">
      <div className="card">
        <h2>
          Your numbers <span>people, and how many did it</span>
        </h2>
        <fieldset className="ab-group">
          <legend>Version A</legend>
          <div className="fields">
            <label>
              People who saw A
              <input inputMode="numeric" value={f.av} onChange={set("av")} aria-invalid={Boolean(errors.av)} aria-describedby={errors.av ? "ab-av-err" : undefined} />
            </label>
            <label>
              Did the thing
              <input inputMode="numeric" value={f.ac} onChange={set("ac")} aria-invalid={Boolean(errors.ac)} aria-describedby={errors.ac ? "ab-ac-err" : undefined} />
            </label>
          </div>
          {errors.av && <p className="note bad" id="ab-av-err">{errors.av}</p>}
          {errors.ac && <p className="note bad" id="ab-ac-err">{errors.ac}</p>}
        </fieldset>
        <fieldset className="ab-group">
          <legend>Version B</legend>
          <div className="fields">
            <label>
              People who saw B
              <input inputMode="numeric" value={f.bv} onChange={set("bv")} aria-invalid={Boolean(errors.bv)} aria-describedby={errors.bv ? "ab-bv-err" : undefined} />
            </label>
            <label>
              Did the thing
              <input inputMode="numeric" value={f.bc} onChange={set("bc")} aria-invalid={Boolean(errors.bc)} aria-describedby={errors.bc ? "ab-bc-err" : undefined} />
            </label>
          </div>
          {errors.bv && <p className="note bad" id="ab-bv-err">{errors.bv}</p>}
          {errors.bc && <p className="note bad" id="ab-bc-err">{errors.bc}</p>}
        </fieldset>
        <div className="examples">
          <span className="hint">Try an example:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex.label} type="button" className="btn small" onClick={() => setF(ex.fields)}>
              {ex.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" aria-live="polite">
        <h2>
          Result <span>two-sided test</span>
        </h2>
        <div className="race" aria-hidden="true">
          <i style={{ width: `${hasData ? Math.max(4, (cmp.rateA / scale) * 100) : 4}%` }}>A {hasData ? pct(cmp.rateA) : "–"}</i>
        </div>
        <div className="race" aria-hidden="true">
          <i style={{ width: `${hasData ? Math.max(4, (cmp.rateB / scale) * 100) : 4}%` }}>B {hasData ? pct(cmp.rateB) : "–"}</i>
        </div>
        <p className="sr-only">
          {hasData ? `Version A converted ${pct(cmp.rateA)}, version B ${pct(cmp.rateB)}.` : "No numbers entered yet."}
        </p>
        <p className="big num">p = {hasData ? showP(cmp.pValue) : "–"}</p>
        {hasData && <Bell z={cmp.z} />}
        {/* the live region stays put so screen readers announce changes; the box inside re-enters when the verdict changes */}
        <div role="status">
          <div className={`verdict ${text.tone}`} key={text.tone}>
            <b>{text.head}</b> {text.body}
          </div>
        </div>
      </div>

      <div className="card ab-help">
        <h2>How to read it</h2>
        <ul>
          <li>
            <b>The p-value</b> is how often pure luck would give a gap at least as big as yours. Under 0.05 means luck is an unlikely explanation.
          </li>
          <li>
            <b>Decide how many people you need before you start</b>, and look once at the end. Checking every day and stopping the moment p dips below 0.05 will fool you.
          </li>
          <li>
            <b>A real difference can still be tiny.</b> Look at the size of the gap, not only the p-value.
          </li>
        </ul>
      </div>
    </div>
  );
}
