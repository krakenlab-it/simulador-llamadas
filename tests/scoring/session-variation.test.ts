import { describe, expect, it } from "vitest";
import { getClientBySlug } from "@/lib/clients";
import { mergeAgenticRuntime } from "@/lib/agentic/runtime";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { getClientReply } from "@/lib/scoring/reactions";
import { getClinicOpeningLine } from "@/lib/simulation/openings";
import { pickVariedLine } from "@/lib/simulation/session-variation";

describe("session-varied clinic dialogue", () => {
  const mariana = getClientBySlug("mariana");
  if (!mariana) throw new Error("mariana fixture missing");

  it("picks different apertura openings for the same slug with different seeds", () => {
    const seedA = "clinic-session-seed-alpha";
    const seedB = "clinic-session-seed-beta";

    const openingA = getClinicOpeningLine(mariana, seedA);
    const openingB = getClinicOpeningLine(mariana, seedB);

    expect(openingA).toBeTruthy();
    expect(openingB).toBeTruthy();
    expect(openingA).not.toBe(openingB);
  });

  it("returns the same opening for the same seed (deterministic)", () => {
    const seed = "clinic-session-seed-stable";
    expect(getClinicOpeningLine(mariana, seed)).toBe(
      getClinicOpeningLine(mariana, seed),
    );
  });

  it("varies templated replies across seeds when agentic is off", () => {
    const replies = new Set(
      Array.from({ length: 24 }, (_, index) =>
        getClientReply("mariana", "apertura", "mal", {
          sessionSeed: `clinic-variation-seed-${index}`,
          turnNumber: 1,
        }),
      ),
    );

    expect(replies.size).toBeGreaterThan(1);
  });

  it("avoids repeating the exact previous client line in the same call", () => {
    const pool = ["Línea uno.", "Línea dos.", "Línea tres."];
    const first = pickVariedLine(pool, {
      sessionSeed: "anti-repeat-seed",
      salt: "objecion:2:mal",
    });
    const second = pickVariedLine(pool, {
      sessionSeed: "anti-repeat-seed",
      salt: "objecion:3:mal",
      priorClientLines: [first],
    });

    expect(second).not.toBe(first);
  });

  it("uses agentic character path for clinic presets when enabled", async () => {
    const preset = buildPresetScenarioConfig("mariana");
    expect(preset).toBeTruthy();
    const config = mergeAgenticRuntime(preset!, {
      enabled: true,
      sessionSeed: "agentic-clinic-seed",
    });

    const live = await scoreLiveTurn({
      utterance:
        "Buenos días Mariana, le llamo por las visitas a caseta que no están convirtiendo.",
      roundKey: "apertura",
      roundType: "apertura",
      roundLabel: "Apertura",
      roundGoal: "Enganchar con visitas a caseta",
      difficultyLevel: 2,
      scenarioSlug: "mariana",
      isPreset: true,
      config,
      clientName: "Mariana Escobedo",
      isLastRound: false,
      roundNumber: 1,
      sessionSeed: "agentic-clinic-seed",
      priorLines: [{ role: "client", text: "¿Quién habla? Estoy entre juntas." }],
    });

    expect(live.clientReply.length).toBeGreaterThan(5);
    expect(live.coaching.note.length).toBeGreaterThan(5);
  });
});
