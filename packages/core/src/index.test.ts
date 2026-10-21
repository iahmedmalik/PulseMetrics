import { describe, expect, it } from "vitest";
import { APP_NAME } from "./index";

describe("core", () => {
  it("is wired into the workspace", () => {
    expect(APP_NAME).toBe("PulseMetrics");
  });
});
