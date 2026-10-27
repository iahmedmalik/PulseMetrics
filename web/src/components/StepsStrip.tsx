import { icons } from "./icons";

type State = "done" | "now" | "later";

// Three first steps, drawn from what is true: a site exists, then the first event arrives.
export function StepsStrip({ hasSite, hasEvents, siteName }: { hasSite: boolean; hasEvents: boolean; siteName?: string }) {
  // Once events arrive all three are done: one short line instead of three cards, so the sites come first.
  if (hasEvents) {
    return (
      <p className="step done steps-live">
        <b aria-hidden="true">{icons.check}</b>
        <span>
          <strong>You are live</strong>
          All three first steps are done and events are arriving.
        </span>
      </p>
    );
  }
  const steps: { title: string; text: string; state: State }[] = [
    { title: "Make a site", text: "Name it, get a key", state: hasSite ? "done" : "now" },
    {
      title: "Paste the snippet",
      text: hasEvents ? "Events are arriving" : hasSite ? "One script tag in your page" : "One script tag in your page",
      state: hasEvents ? "done" : hasSite ? "now" : "later",
    },
    {
      title: "First event arrives",
      text: hasEvents ? "You are live" : siteName ? `Waiting for ${siteName}` : "Then the charts fill in",
      state: hasEvents ? "done" : "later",
    },
  ];
  return (
    <ol className="steps" aria-label="Getting started">
      {steps.map((s, i) => (
        <li key={s.title} className={`step ${s.state}`} aria-current={s.state === "now" ? "step" : undefined}>
          <b aria-hidden="true">{s.state === "done" ? icons.check : i + 1}</b>
          <span>
            <strong>{s.title}</strong>
            {s.text}
          </span>
        </li>
      ))}
    </ol>
  );
}
