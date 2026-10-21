// Turns the raw funnel rows (people at each step) into what the screen shows: percentages, how many left
// at each step, the biggest drop, and a warning when too few people started for the percentages to mean much.

export type FunnelRow = { step: number; name: string; people: number };

export type FunnelStep = FunnelRow & {
  /** whole percent of the previous step who carried on; null for step 1 or when nobody was there to carry on */
  ofPrevious: number | null;
  /** whole percent of the people at step 1 who got this far */
  ofFirst: number | null;
  /** people at the previous step who did not carry on to this one (0 for step 1) */
  left: number;
};

export type FunnelShape = {
  steps: FunnelStep[];
  started: number;
  finished: number;
  /** whole percent of the people at step 1 who got to the last step; null when nobody started */
  overall: number | null;
  /** the step change that lost the most people, or null when nobody was lost */
  biggestDrop: { from: number; to: number; fromName: string; toName: string; left: number; percentOfPrevious: number } | null;
  /** fewer than 30 people started: the percentages are only a rough guide */
  smallSample: boolean;
};

export const SMALL_SAMPLE = 30;

const percent = (part: number, whole: number): number | null => (whole <= 0 ? null : Math.round((part / whole) * 100));

export function shapeFunnel(rows: FunnelRow[]): FunnelShape {
  const sorted = [...rows].sort((a, b) => a.step - b.step);

  // Counts can only go down along a funnel. The database guarantees it; clamp anyway so the screen never shows a rise.
  const people: number[] = [];
  for (const r of sorted) people.push(Math.max(0, Math.min(r.people, people.length === 0 ? Infinity : people[people.length - 1]!)));

  const started = people[0] ?? 0;
  const steps: FunnelStep[] = sorted.map((r, i) => ({
    ...r,
    people: people[i]!,
    ofPrevious: i === 0 ? null : percent(people[i]!, people[i - 1]!),
    ofFirst: i === 0 ? (started > 0 ? 100 : null) : percent(people[i]!, started),
    left: i === 0 ? 0 : people[i - 1]! - people[i]!,
  }));

  let biggestDrop: FunnelShape["biggestDrop"] = null;
  for (let i = 1; i < steps.length; i++) {
    const s = steps[i]!;
    // on a tie the earlier drop is reported: fix the first leak first
    if (s.left > 0 && (biggestDrop === null || s.left > biggestDrop.left)) {
      biggestDrop = {
        from: steps[i - 1]!.step,
        to: s.step,
        fromName: steps[i - 1]!.name,
        toName: s.name,
        left: s.left,
        percentOfPrevious: 100 - (s.ofPrevious ?? 0),
      };
    }
  }

  const finished = people[people.length - 1] ?? 0;
  return {
    steps,
    started,
    finished,
    overall: percent(finished, started),
    biggestDrop,
    smallSample: started < SMALL_SAMPLE,
  };
}

/** "queue_joined" becomes "Queue joined": a readable label for an event name. */
export function eventLabel(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
