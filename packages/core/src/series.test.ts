import { describe, expect, it } from "vitest";
import { dayLabel, movingAverage, summarize } from "./series";

describe("dayLabel", () => {
  it("names the weekday and the day of the month", () => {
    expect(dayLabel("2026-10-08")).toBe("Thu 8");
    expect(dayLabel("2026-10-21")).toBe("Wed 21");
    expect(dayLabel("2026-01-01")).toBe("Thu 1");
  });
  it("is not moved by a time zone (it reads the calendar day)", () => {
    expect(dayLabel("2026-03-29")).toBe("Sun 29");
    expect(dayLabel("2026-12-31")).toBe("Thu 31");
  });
  it("hands back something it cannot read unchanged", () => {
    expect(dayLabel("soon")).toBe("soon");
  });
});

describe("movingAverage", () => {
  it("averages each value with the ones before it", () => {
    expect(movingAverage([10, 20, 30, 40], 2)).toEqual([10, 15, 25, 35]);
  });
  it("uses fewer values at the start", () => {
    expect(movingAverage([6, 0, 0], 7)).toEqual([6, 3, 2]);
  });
  it("keeps the length and handles an empty list", () => {
    expect(movingAverage([1, 2, 3], 3)).toHaveLength(3);
    expect(movingAverage([], 7)).toEqual([]);
  });
});

describe("summarize", () => {
  const days = [
    { day: "2026-10-18", people: 10 },
    { day: "2026-10-19", people: 30 },
    { day: "2026-10-20", people: 20 },
    { day: "2026-10-21", people: 5 },
  ];

  it("reports today so far, the busiest day and the average of completed days", () => {
    const s = summarize(days, "2026-10-21");
    expect(s.today).toBe(5);
    expect(s.busiest).toEqual({ day: "2026-10-19", people: 30 });
    expect(s.average).toBe(20); // (10 + 30 + 20) / 3: today is not finished, so it is left out
    expect(s.hasData).toBe(true);
  });

  it("lets today be the busiest day when it is", () => {
    expect(summarize([...days.slice(0, 3), { day: "2026-10-21", people: 99 }], "2026-10-21").busiest?.day).toBe("2026-10-21");
  });

  it("prefers the later day on a tie", () => {
    const tie = [
      { day: "2026-10-19", people: 7 },
      { day: "2026-10-20", people: 7 },
    ];
    expect(summarize(tie, "2026-10-21").busiest?.day).toBe("2026-10-20");
  });

  it("says there is no data when every day is zero", () => {
    const empty = days.map((d) => ({ ...d, people: 0 }));
    const s = summarize(empty, "2026-10-21");
    expect(s.hasData).toBe(false);
    expect(s.busiest).toBeNull();
    expect(s.average).toBe(0);
    expect(s.today).toBe(0);
  });

  it("copes with a range that does not include today, and with no days at all", () => {
    expect(summarize(days.slice(0, 3), "2026-11-01").today).toBe(0);
    const none = summarize([], "2026-10-21");
    expect(none.hasData).toBe(false);
    expect(none.average).toBe(0);
  });
});
