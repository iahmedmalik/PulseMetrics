// Small pure helpers for the daily active browsers chart and its scoreboard.

export type DayCount = { day: string; people: number };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** "2026-10-08" becomes "Thu 8". The date is read as a calendar day, with no time zone involved. */
export function dayLabel(isoDay: string): string {
  const [y, m, d] = isoDay.split("-").map(Number);
  if (!y || !m || !d) return isoDay;
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}

/** Each value averaged with the ones before it, up to `window` values (fewer at the start). */
export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

export type Summary = {
  /** browsers active today so far (today is still counting) */
  today: number;
  /** the busiest day in the range, or null when nothing was recorded */
  busiest: DayCount | null;
  /** the mean over completed days, rounded; today is left out because it is not finished */
  average: number;
  /** true when at least one browser was active on any day in the range */
  hasData: boolean;
};

export function summarize(days: DayCount[], today: string): Summary {
  const todayRow = days.find((d) => d.day === today);
  const completed = days.filter((d) => d.day !== today);
  const hasData = days.some((d) => d.people > 0);

  let busiest: DayCount | null = null;
  for (const d of days) {
    // on a tie the later day wins: it is the more recent news
    if (d.people > 0 && (busiest === null || d.people >= busiest.people)) busiest = d;
  }

  const average = completed.length === 0 ? 0 : Math.round(completed.reduce((n, d) => n + d.people, 0) / completed.length);
  return { today: todayRow?.people ?? 0, busiest, average, hasData };
}
