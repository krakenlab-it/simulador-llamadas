import { describe, expect, it } from "vitest";
import { mergePresetAgenticRuntime } from "@/lib/scenarios/preset-config";
import { isAgenticSessionActive } from "@/lib/agentic/runtime";

describe("preset agentic session config", () => {
  it("builds a clinic preset config with agentic enabled for persistence", () => {
    const config = mergePresetAgenticRuntime(
      "mariana",
      { enabled: true, toneId: "desconfianza" },
      "call-attempt-123",
    );

    expect(config).not.toBeNull();
    expect(isAgenticSessionActive(config)).toBe(true);
    expect(config?.agentic?.sessionSeed).toBe("call-attempt-123");
    expect(config?.industry).toBeTruthy();
    expect(config?.objections.length).toBeGreaterThan(0);
  });
});
