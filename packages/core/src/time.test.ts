import { describe, expect, it } from "vitest";
import { timeAgo } from "./time";

const now = new Date("2026-10-21T12:00:00Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

describe("timeAgo", () => {
  it("says just now for the last few seconds", () => {
    expect(timeAgo(ago(0), now)).toBe("just now");
    expect(timeAgo(ago(9), now)).toBe("just now");
  });
  it("counts seconds, minutes, hours and days", () => {
    expect(timeAgo(ago(10), now)).toBe("10 s ago");
    expect(timeAgo(ago(59), now)).toBe("59 s ago");
    expect(timeAgo(ago(60), now)).toBe("1 min ago");
    expect(timeAgo(ago(59 * 60), now)).toBe("59 min ago");
    expect(timeAgo(ago(60 * 60), now)).toBe("1 h ago");
    expect(timeAgo(ago(23 * 3600), now)).toBe("23 h ago");
    expect(timeAgo(ago(24 * 3600), now)).toBe("1 d ago");
    expect(timeAgo(ago(5 * 24 * 3600), now)).toBe("5 d ago");
  });
  it("treats a time slightly in the future (a clock a little ahead) as just now", () => {
    expect(timeAgo(new Date(now.getTime() + 3000).toISOString(), now)).toBe("just now");
  });
});
