"use client";

import { eventLabel } from "@pulse/core";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

const MIN = 2;
const MAX = 6;

// Choose 2 to 6 of the events this site has sent, in the order people take them.
export function StepsPicker({ names, selected, range }: { names: string[]; selected: string[]; range: number }) {
  const router = useRouter();
  const [steps, setSteps] = useState<string[]>(selected);
  const options = Array.from(new Set([...names, ...selected]));
  const unused = options.filter((n) => !steps.includes(n));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    router.push(`/funnel?steps=${encodeURIComponent(steps.join(","))}&range=${range}`);
  }

  return (
    <form className="card steps-form" onSubmit={onSubmit}>
      <h2>
        Steps <span>{MIN} to {MAX}, in order</span>
      </h2>
      <ol className="step-rows">
        {steps.map((step, i) => (
          <li key={i}>
            <label>
              <span className="sr-only">Step {i + 1}</span>
              <b aria-hidden="true">{i + 1}</b>
              <select value={step} onChange={(e) => setSteps(steps.map((s, j) => (j === i ? e.target.value : s)))}>
                {options
                  .filter((n) => n === step || !steps.includes(n))
                  .map((n) => (
                    <option key={n} value={n}>
                      {eventLabel(n)}
                    </option>
                  ))}
              </select>
            </label>
            {steps.length > MIN && (
              <button type="button" className="btn small" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`}>
                Remove
              </button>
            )}
          </li>
        ))}
      </ol>
      <div className="card-actions">
        {steps.length < MAX && unused.length > 0 && (
          <button type="button" className="btn" onClick={() => setSteps([...steps, unused[0]!])}>
            Add a step
          </button>
        )}
        <button type="submit" className="btn primary">
          Show funnel
        </button>
      </div>
    </form>
  );
}
