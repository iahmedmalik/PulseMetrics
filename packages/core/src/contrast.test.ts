import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AA_LARGE, AA_TEXT, contrastRatio, luminance } from "./contrast";

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for the same colour", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#336699", "#336699")).toBeCloseTo(1, 5);
  });
  it("does not depend on which colour is first", () => {
    expect(contrastRatio("#0d2a1e", "#e9f1e6")).toBeCloseTo(contrastRatio("#e9f1e6", "#0d2a1e"), 10);
  });
  it("matches a known value: #767676 on white is 4.54", () => {
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
  it("rejects a colour it cannot read", () => {
    expect(() => luminance("green")).toThrow();
    expect(() => luminance("#fff")).toThrow();
  });
});

// The design tokens, read from the real stylesheet so the test cannot drift from what ships.
const css = readFileSync(new URL("../../../web/src/app/globals.css", import.meta.url), "utf8");
const token = (name: string): string => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(css);
  if (!m) throw new Error(`token --${name} not found in globals.css`);
  return m[1]!;
};

describe("the design tokens meet WCAG 2.2 AA", () => {
  const grounds = ["bg1", "bg2", "card", "card2", "plate", "well"];

  it.each(grounds)("chalk text on %s is at least 4.5:1", (g) => {
    expect(contrastRatio(token("chalk"), token(g))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(["bg2", "card", "card2", "well"])("muted text on %s is at least 4.5:1", (g) => {
    expect(contrastRatio(token("mute"), token(g))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(["bg2", "card", "card2", "well"])("pale amber text on %s is at least 4.5:1", (g) => {
    expect(contrastRatio(token("acc-t"), token(g))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each(["card", "card2", "well"])("pale red text on %s is at least 4.5:1", (g) => {
    expect(contrastRatio(token("trace-t"), token(g))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the dark text on the amber button is at least 4.5:1", () => {
    expect(contrastRatio(token("on-acc"), token("acc"))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("the dark text on the red delete button is at least 4.5:1", () => {
    expect(contrastRatio("#1a0507", token("trace"))).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it.each([
    ["the pen trace", "trace"],
    ["the bars", "bar"],
    ["the amber highlight", "acc"],
  ])("%s stands out from the chart plate by at least 3:1", (_label, name) => {
    expect(contrastRatio(token(name), token("plate"))).toBeGreaterThanOrEqual(AA_LARGE);
  });

  // WCAG 1.4.11: the edge of a field or a button is what tells you it is one, so it needs 3:1 against what it sits on.
  // (Card borders are decoration: a card is told apart by its fill and shadow, so --line is not held to this.)
  it.each(["card", "card2", "well", "bg2"])("the edge of fields and buttons (--line-strong) is at least 3:1 on %s", (g) => {
    expect(contrastRatio(token("line-strong"), token(g))).toBeGreaterThanOrEqual(AA_LARGE);
  });
});
