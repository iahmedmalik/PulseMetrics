import { describe, expect, it } from "vitest";
import { eventLabel, shapeFunnel, SMALL_SAMPLE } from "./funnel";

const rows = (...people: number[]) => people.map((p, i) => ({ step: i + 1, name: `step_${i + 1}`, people: p }));

describe("shapeFunnel", () => {
  it("works out percentages of the previous step and of the first", () => {
    const f = shapeFunnel(rows(412, 301, 244));
    expect(f.steps.map((s) => s.ofPrevious)).toEqual([null, 73, 81]);
    expect(f.steps.map((s) => s.ofFirst)).toEqual([100, 73, 59]);
    expect(f.steps.map((s) => s.left)).toEqual([0, 111, 57]);
    expect(f.started).toBe(412);
    expect(f.finished).toBe(244);
    expect(f.overall).toBe(59);
  });

  it("reports the biggest drop by people lost, with where it happened", () => {
    const f = shapeFunnel(rows(412, 301, 244));
    expect(f.biggestDrop).toEqual({ from: 1, to: 2, fromName: "step_1", toName: "step_2", left: 111, percentOfPrevious: 27 });
  });

  it("reports the earlier drop on a tie", () => {
    const f = shapeFunnel(rows(100, 60, 20));
    expect(f.steps.map((s) => s.left)).toEqual([0, 40, 40]);
    expect(f.biggestDrop?.from).toBe(1);
  });

  it("has no biggest drop when nobody was lost", () => {
    expect(shapeFunnel(rows(50, 50, 50)).biggestDrop).toBeNull();
  });

  it("copes with nobody at all: no percentages, no division by zero", () => {
    const f = shapeFunnel(rows(0, 0, 0));
    expect(f.steps.map((s) => s.ofPrevious)).toEqual([null, null, null]);
    expect(f.steps.map((s) => s.ofFirst)).toEqual([null, null, null]);
    expect(f.overall).toBeNull();
    expect(f.biggestDrop).toBeNull();
    expect(f.smallSample).toBe(true);
  });

  it("copes with everybody dropping out after the first step", () => {
    const f = shapeFunnel(rows(40, 0, 0));
    expect(f.steps.map((s) => s.ofPrevious)).toEqual([null, 0, null]);
    expect(f.steps.map((s) => s.ofFirst)).toEqual([100, 0, 0]);
    expect(f.overall).toBe(0);
    expect(f.biggestDrop?.left).toBe(40);
  });

  it("never shows a step that is bigger than the one before it", () => {
    const f = shapeFunnel(rows(10, 12, 5));
    expect(f.steps.map((s) => s.people)).toEqual([10, 10, 5]);
    expect(f.steps.every((s) => s.left >= 0)).toBe(true);
  });

  it("puts the steps in order whatever order the rows arrive in", () => {
    const f = shapeFunnel([rows(30, 20, 10)[2]!, rows(30, 20, 10)[0]!, rows(30, 20, 10)[1]!]);
    expect(f.steps.map((s) => s.step)).toEqual([1, 2, 3]);
    expect(f.steps.map((s) => s.people)).toEqual([30, 20, 10]);
  });

  it("warns about a small sample below 30 people at the start", () => {
    expect(shapeFunnel(rows(SMALL_SAMPLE - 1, 5)).smallSample).toBe(true);
    expect(shapeFunnel(rows(SMALL_SAMPLE, 5)).smallSample).toBe(false);
  });

  it("copes with an empty list", () => {
    const f = shapeFunnel([]);
    expect(f.steps).toEqual([]);
    expect(f.started).toBe(0);
    expect(f.overall).toBeNull();
  });
});

describe("eventLabel", () => {
  it("makes an event name readable", () => {
    expect(eventLabel("queue_joined")).toBe("Queue joined");
    expect(eventLabel("called_in")).toBe("Called in");
    expect(eventLabel("signup")).toBe("Signup");
  });
});
