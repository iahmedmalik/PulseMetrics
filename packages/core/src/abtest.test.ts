import { describe, expect, it } from "vitest";
import { abVerdict, compareProportions, normalCdf } from "./abtest";

describe("normalCdf", () => {
  it("is 0.5 at zero", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });
  it("matches the textbook table", () => {
    expect(normalCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 5);
    expect(normalCdf(1.96)).toBeCloseTo(0.975002, 5);
    expect(normalCdf(2.576)).toBeCloseTo(0.995, 3);
  });
  it("is symmetric and stays between 0 and 1", () => {
    expect(normalCdf(0.7) + normalCdf(-0.7)).toBeCloseTo(1, 6);
    expect(normalCdf(10)).toBeLessThanOrEqual(1);
    expect(normalCdf(-10)).toBeGreaterThanOrEqual(0);
  });
});

describe("compareProportions", () => {
  it("10% v 12% with 1,000 each: p is about 0.153, so this could easily be luck", () => {
    const r = compareProportions({ visitors: 1000, conversions: 100 }, { visitors: 1000, conversions: 120 });
    expect(r.rateA).toBeCloseTo(0.1, 6);
    expect(r.rateB).toBeCloseTo(0.12, 6);
    expect(r.difference).toBeCloseTo(0.02, 6);
    expect(r.z).toBeCloseTo(1.429, 3);
    expect(r.pValue).toBeCloseTo(0.153, 3);
  });

  it("10% v 16% with 500 each: p is about 0.005, a real difference", () => {
    const r = compareProportions({ visitors: 500, conversions: 50 }, { visitors: 500, conversions: 80 });
    expect(r.z).toBeCloseTo(2.821, 3);
    expect(r.pValue).toBeCloseTo(0.0048, 3);
  });

  it("gives the same p-value whichever way round the groups are", () => {
    const a = { visitors: 400, conversions: 40 };
    const b = { visitors: 380, conversions: 55 };
    expect(compareProportions(a, b).pValue).toBeCloseTo(compareProportions(b, a).pValue, 10);
    expect(compareProportions(a, b).z).toBeCloseTo(-compareProportions(b, a).z, 10);
  });

  it("equal rates: no difference, p is 1", () => {
    const r = compareProportions({ visitors: 200, conversions: 20 }, { visitors: 200, conversions: 20 });
    expect(r.difference).toBe(0);
    expect(r.pValue).toBeCloseTo(1, 6);
  });

  it("nobody converted in either group: no crash, p is 1", () => {
    const r = compareProportions({ visitors: 100, conversions: 0 }, { visitors: 100, conversions: 0 });
    expect(r.pValue).toBe(1);
    expect(Number.isFinite(r.z)).toBe(true);
  });

  it("everybody converted in both groups: no crash, p is 1", () => {
    const r = compareProportions({ visitors: 50, conversions: 50 }, { visitors: 60, conversions: 60 });
    expect(r.pValue).toBe(1);
  });

  it("a group with no visitors: no crash, p is 1", () => {
    const r = compareProportions({ visitors: 0, conversions: 0 }, { visitors: 100, conversions: 10 });
    expect(r.pValue).toBe(1);
    expect(r.rateA).toBe(0);
  });

  it("clamps conversions that exceed visitors, and negatives", () => {
    const r = compareProportions({ visitors: 10, conversions: 99 }, { visitors: 10, conversions: -4 });
    expect(r.rateA).toBe(1);
    expect(r.rateB).toBe(0);
  });

  it("a huge, clear gap has a tiny p", () => {
    const r = compareProportions({ visitors: 5000, conversions: 500 }, { visitors: 5000, conversions: 800 });
    expect(r.pValue).toBeLessThan(0.0001);
  });
});

describe("abVerdict", () => {
  it("says there is no data when a group is empty", () => {
    expect(abVerdict({ visitors: 0, conversions: 0 }, { visitors: 10, conversions: 1 })).toEqual({ kind: "no_data" });
  });

  it("warns about a small sample before anything else", () => {
    // 3 of 10 v 9 of 10 would give a small p, but there are too few people to trust it.
    expect(abVerdict({ visitors: 10, conversions: 3 }, { visitors: 10, conversions: 9 })).toEqual({ kind: "small_sample" });
  });

  it("warns when a group has fewer than 5 conversions", () => {
    expect(abVerdict({ visitors: 1000, conversions: 4 }, { visitors: 1000, conversions: 40 })).toEqual({ kind: "small_sample" });
  });

  it("warns when a group has fewer than 5 who did not convert", () => {
    expect(abVerdict({ visitors: 100, conversions: 97 }, { visitors: 100, conversions: 50 })).toEqual({ kind: "small_sample" });
  });

  it("does NOT crown B at p = 0.15 (the plan's checkpoint question)", () => {
    expect(abVerdict({ visitors: 1000, conversions: 100 }, { visitors: 1000, conversions: 120 })).toEqual({
      kind: "not_enough_evidence",
    });
  });

  it("calls B better only when p is under 0.05", () => {
    expect(abVerdict({ visitors: 500, conversions: 50 }, { visitors: 500, conversions: 80 })).toEqual({
      kind: "different",
      better: "B",
    });
  });

  it("calls A better when A is clearly ahead", () => {
    expect(abVerdict({ visitors: 500, conversions: 80 }, { visitors: 500, conversions: 50 })).toEqual({
      kind: "different",
      better: "A",
    });
  });
});
