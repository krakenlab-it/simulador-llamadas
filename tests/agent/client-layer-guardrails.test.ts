import { describe, expect, it } from "vitest";
import {
  buildCoachSeparationGuardrail,
  buildLiveClientGuardrailsBlock,
  mergeClientLayerSettings,
  patchClientLayerEngineCopy,
  parseClientLayerSettings,
} from "@/lib/agent/client-layer";

describe("client layer guardrail copy", () => {
  it("includes trainer overrides in the live client block", () => {
    const layer = patchClientLayerEngineCopy(
      parseClientLayerSettings({ motorEnabled: true, toneId: "auto" }),
      "grounding",
      { body: "Solo cifras del pack aprobado." },
    );
    const block = buildLiveClientGuardrailsBlock(layer);
    expect(block).toContain("Solo cifras del pack aprobado.");
    expect(block).toContain("Persona y tono");
  });

  it("merges trainer overlay onto scenario layer for calls", () => {
    const scenario = parseClientLayerSettings({
      motorEnabled: true,
      toneId: "molesto",
    });
    const trainer = patchClientLayerEngineCopy(
      parseClientLayerSettings({ motorEnabled: false, toneId: "auto" }),
      "dialogo",
      { body: "Máximo dos frases por turno." },
    );
    const merged = mergeClientLayerSettings(scenario, trainer);
    expect(merged.toneId).toBe("molesto");
    expect(merged.motorEnabled).toBe(true);
    expect(buildLiveClientGuardrailsBlock(merged)).toContain(
      "Máximo dos frases por turno.",
    );
  });

  it("feeds coach separation line from editable copy", () => {
    const layer = patchClientLayerEngineCopy(
      parseClientLayerSettings(null),
      "coach",
      { body: "El feedback va al vendedor, no al micrófono del cliente." },
    );
    expect(buildCoachSeparationGuardrail(layer)).toContain(
      "El feedback va al vendedor",
    );
  });
});
