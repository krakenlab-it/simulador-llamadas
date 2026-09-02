import { describe, expect, it } from "vitest";
import {
  durationSecondsBetween,
  formatDurationLabel,
} from "@/lib/session/duration";

describe("call duration helpers", () => {
  it("returns elapsed seconds between start and hang-up", () => {
    expect(
      durationSecondsBetween(
        "2026-09-02T10:00:00.000Z",
        "2026-09-02T10:03:20.000Z",
      ),
    ).toBe(200);
  });

  it("returns null while the call is still open", () => {
    expect(durationSecondsBetween("2026-09-02T10:00:00.000Z", null)).toBeNull();
  });

  it("formats short and long calls for the dashboard", () => {
    expect(formatDurationLabel(45)).toBe("45 s");
    expect(formatDurationLabel(60)).toBe("1 min");
    expect(formatDurationLabel(200)).toBe("3 min 20 s");
    expect(formatDurationLabel(null)).toBe("—");
  });
});
