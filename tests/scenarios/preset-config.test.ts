import { describe, expect, it } from "vitest";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";

describe("buildPresetScenarioConfig", () => {
  it("builds Groq-ready config for rodrigo", () => {
    const config = buildPresetScenarioConfig("rodrigo");
    expect(config).not.toBeNull();
    expect(config?.industry).toContain("farmacias");
    expect(config?.openingLines).toContain(
      "Si es otro discurso de branding, cuelgo.",
    );
    expect(config?.rounds).toHaveLength(5);
  });

  it("returns null for non-preset slugs", () => {
    expect(buildPresetScenarioConfig("custom-gym")).toBeNull();
  });
});
