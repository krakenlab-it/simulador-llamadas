import { describe, expect, it } from "vitest";
import {
  CLIENT_LAYER_ENGINES,
  DEFAULT_CLIENT_LAYER_SETTINGS,
  mapDifficultyToJaime,
  parseClientLayerSettings,
  snapshotSessionConfig,
  toneHint,
} from "@/lib/agent/client-layer";

describe("client layer knobs", () => {
  it("defaults to a live motor and the character tone", () => {
    expect(DEFAULT_CLIENT_LAYER_SETTINGS).toEqual({
      motorEnabled: true,
      toneId: "auto",
    });
    expect(CLIENT_LAYER_ENGINES.map((engine) => engine.id)).toEqual([
      "grounding",
      "persona",
      "dialogo",
      "coach",
    ]);
  });

  it("parses missing or junk knobs without opening a 20-field form", () => {
    expect(parseClientLayerSettings(null)).toEqual(DEFAULT_CLIENT_LAYER_SETTINGS);
    expect(parseClientLayerSettings({ motorEnabled: false, toneId: "nope" })).toEqual({
      motorEnabled: false,
      toneId: "auto",
    });
    expect(
      parseClientLayerSettings({ motorEnabled: true, toneId: "prepotencia" }),
    ).toEqual({ motorEnabled: true, toneId: "prepotencia" });
  });

  it("maps clinic difficulty 1-3 to Jaime 2/3/5", () => {
    expect(mapDifficultyToJaime(1)).toBe(2);
    expect(mapDifficultyToJaime(2)).toBe(3);
    expect(mapDifficultyToJaime(3)).toBe(5);
  });

  it("keeps auto tone as the character temperament", () => {
    expect(toneHint("auto", "Escéptica, entre juntas")).toBe(
      "Escéptica, entre juntas",
    );
    expect(toneHint("molesto", "Escéptica, entre juntas")).toMatch(/Molesto/);
  });

  it("snapshots the few trainer knobs for a call", () => {
    expect(
      snapshotSessionConfig({
        clientLayer: { motorEnabled: false, toneId: "amigable" },
        language: "en",
        difficultyLevel: 2,
        mode: "texto",
      }),
    ).toEqual({
      clientLayer: { motorEnabled: false, toneId: "amigable" },
      language: "en",
      difficultyLevel: 2,
      mode: "texto",
    });
  });
});
