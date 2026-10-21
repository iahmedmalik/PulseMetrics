import { describe, expect, it } from "vitest";
import { isValidAnonId, isValidEventName, isValidSiteKey } from "./events";

describe("event names (rule P-1)", () => {
  it.each(["queue_joined", "status_viewed", "called_in", "payment_recorded", "member_link_opened", "ab", "step_2_done"])(
    "accepts the fixed name %s",
    (name) => {
      expect(isValidEventName(name)).toBe(true);
    },
  );

  it.each([
    ["a page address", "https://committeekeeper.vercel.app/m/abc123"],
    ["a path", "/m/k3j2h4g5f6d7s8a9"],
    ["a path without slashes", "m_k3j2h4g5f6d7s8a9q1w2"],
    ["an email", "ali@example.com"],
    ["a phone number", "03001234567"],
    ["a phone number with a prefix", "phone_03001234567"],
    ["a uuid", "123e4567-e89b-12d3-a456-426614174000"],
    ["a 32 character random token", "k3j2h4g5f6d7s8a9q1w2e3r4t5y6u7i8"],
    ["a name with capitals", "QueueJoined"],
    ["a name with spaces", "queue joined"],
    ["a name starting with a digit", "1_queue"],
    ["a name with a hyphen", "queue-joined"],
    ["a single letter", "a"],
    ["too long (41 characters)", "a_".repeat(20) + "a"],
    ["an empty string", ""],
    ["a name ending in an underscore", "queue_"],
    ["a name with a doubled underscore", "queue__joined"],
  ])("refuses %s", (_label, value) => {
    expect(isValidEventName(value)).toBe(false);
  });

  it("refuses things that are not strings", () => {
    for (const v of [undefined, null, 5, {}, [], true]) expect(isValidEventName(v)).toBe(false);
  });
});

describe("browser ids and site keys", () => {
  it("accepts what the snippet makes", () => {
    expect(isValidAnonId("a3f9k2m1x8q7w5e4")).toBe(true);
    expect(isValidAnonId("a3f9k2m1x8q7w5e4r6t2y1u0i9o8p7a6")).toBe(true);
  });
  it("refuses ids that are too short, too long or have other characters", () => {
    expect(isValidAnonId("short")).toBe(false);
    expect(isValidAnonId("a".repeat(33))).toBe(false);
    expect(isValidAnonId("A3F9K2M1X8Q7W5E4")).toBe(false);
    expect(isValidAnonId("a3f9-k2m1-x8q7-w5e4")).toBe(false);
  });
  it("accepts a 24 character hex site key only", () => {
    expect(isValidSiteKey("7f3a0c91e2b44a7d9c1e0b5f")).toBe(true);
    expect(isValidSiteKey("7f3a0c91e2b44a7d9c1e0b5")).toBe(false);
    expect(isValidSiteKey("7F3A0C91E2B44A7D9C1E0B5F")).toBe(false);
    expect(isValidSiteKey("zzzzzzzzzzzzzzzzzzzzzzzz")).toBe(false);
  });
});
