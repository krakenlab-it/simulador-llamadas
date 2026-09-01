import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { scoreTranscriptHeuristic } from "@/lib/scoring/heuristic-scorecard";
import { evaluateAdvanceOutcome } from "@/lib/scoring/outcome";
import { scoreCall } from "@/lib/scoring/score-call";
import {
  FEATURE_DUMP_TRANSCRIPT,
  GOOD_DISCOVERY_TRANSCRIPT,
  STEAMROLLED_OBJECTION_TRANSCRIPT,
  VAGUE_CLOSE_TRANSCRIPT,
} from "../fixtures/scoring/transcripts";

function configFromFixture(fixture: (typeof GOOD_DISCOVERY_TRANSCRIPT)) {
  return buildScenarioConfig({
    industry: fixture.industry,
    productSold: fixture.productSold,
    clientProblem: fixture.clientProblem,
    objections: ["No tengo tiempo", "Ya tengo proveedor"],
    winCriteria: "SPIN Advance: siguiente acción concreta acordada o propuesta",
    temperament: "Escéptico",
    clientName: "Cliente",
  });
}

describe("fixture transcript scorecard", () => {
  it("rates good discovery above feature dump on discovery + dolor", () => {
    const good = scoreTranscriptHeuristic({
      lines: GOOD_DISCOVERY_TRANSCRIPT.lines,
      config: configFromFixture(GOOD_DISCOVERY_TRANSCRIPT),
      isPreset: false,
      callType: "discovery",
    });
    const dump = scoreTranscriptHeuristic({
      lines: FEATURE_DUMP_TRANSCRIPT.lines,
      config: configFromFixture(FEATURE_DUMP_TRANSCRIPT),
      isPreset: false,
      callType: "discovery",
    });

    const goodDiscovery = good.dimensions.find((d) => d.id === "discovery_escucha")!;
    const dumpDiscovery = dump.dimensions.find((d) => d.id === "discovery_escucha")!;
    const goodDolor = good.dimensions.find((d) => d.id === "dolor_implicacion")!;

    expect(goodDiscovery.score).toBeGreaterThan(dumpDiscovery.score);
    expect(goodDolor.score).toBeGreaterThanOrEqual(3.5);
    expect(good.overallScore).toBeGreaterThan(dump.overallScore);
  });

  it("penalizes vague close on cierre/siguiente paso", () => {
    const vague = scoreTranscriptHeuristic({
      lines: VAGUE_CLOSE_TRANSCRIPT.lines,
      config: configFromFixture(VAGUE_CLOSE_TRANSCRIPT),
      isPreset: false,
      callType: "cierre",
    });
    const good = scoreTranscriptHeuristic({
      lines: GOOD_DISCOVERY_TRANSCRIPT.lines,
      config: configFromFixture(GOOD_DISCOVERY_TRANSCRIPT),
      isPreset: false,
      callType: "cierre",
    });

    const vagueClose = vague.dimensions.find((d) => d.id === "cierre_siguiente_paso")!;
    const goodClose = good.dimensions.find((d) => d.id === "cierre_siguiente_paso")!;

    expect(vagueClose.score).toBeLessThan(goodClose.score);
    expect(vague.analytics.hasNextStep).toBe(false);
  });

  it("scores steamrolled objection low on compostura", () => {
    const steamrolled = scoreTranscriptHeuristic({
      lines: STEAMROLLED_OBJECTION_TRANSCRIPT.lines,
      config: configFromFixture(STEAMROLLED_OBJECTION_TRANSCRIPT),
      isPreset: false,
      callType: "cierre",
    });

    const objection = steamrolled.dimensions.find(
      (d) => d.id === "compostura_objecion",
    )!;
    expect(objection.notApplicable).toBe(false);
    expect(objection.score).toBeLessThan(3);
  });

  it("grades gym scenario on 6 dimensions without cpm/ctr/roi keyword jerga", () => {
    const gym = scoreTranscriptHeuristic({
      lines: GOOD_DISCOVERY_TRANSCRIPT.lines,
      config: configFromFixture(GOOD_DISCOVERY_TRANSCRIPT),
      isPreset: false,
    });

    expect(gym.dimensions).toHaveLength(6);
    const valor = gym.dimensions.find((d) => d.id === "valor_tailor")!;
    expect(valor.rationale.toLowerCase()).not.toContain("cpm");
    expect(gym.overallScore).toBeGreaterThan(0);
    expect(gym.overallStars).toBeGreaterThanOrEqual(1);
    expect(gym.overallStars).toBeLessThanOrEqual(5);
  });

  it("builds Spanish debrief skeleton with two better-line variants", async () => {
    const result = await scoreCall({
      lines: GOOD_DISCOVERY_TRANSCRIPT.lines,
      config: configFromFixture(GOOD_DISCOVERY_TRANSCRIPT),
      isPreset: false,
    });

    expect(result.debrief.outcomeLabel).toMatch(/Advance|Continuation/);
    expect(result.debrief.strength.quote.length).toBeGreaterThan(5);
    expect(result.debrief.primaryGap.dimension.length).toBeGreaterThan(3);
    expect(result.debrief.betterLines.variantA.length).toBeGreaterThan(10);
    expect(result.debrief.betterLines.variantB.length).toBeGreaterThan(10);
    expect(result.debrief.betterLines.variantA).not.toBe(
      result.debrief.betterLines.variantB,
    );
    expect(result.debrief.drill.length).toBeGreaterThan(10);
    expect(result.debrief.dimensionTrend.length).toBeGreaterThan(0);
  });

  it("uses SPIN Advance for win, not reunion+weekday regex alone", () => {
    const advanceText =
      "Le envío el resumen hoy y hablamos el martes a las 10 para definir el piloto.";
    const vagueText = "Agendemos una reunión la próxima semana cuando pueda.";

    expect(
      evaluateAdvanceOutcome(
        advanceText,
        "SPIN Advance: siguiente acción concreta acordada o propuesta",
      ),
    ).toBe(true);
    expect(
      evaluateAdvanceOutcome(
        vagueText,
        "SPIN Advance: siguiente acción concreta acordada o propuesta",
      ),
    ).toBe(false);
  });
});

describe("analytics chips (computational)", () => {
  it("detects question types and next-step signal in good discovery", () => {
    const card = scoreTranscriptHeuristic({
      lines: GOOD_DISCOVERY_TRANSCRIPT.lines,
      config: configFromFixture(GOOD_DISCOVERY_TRANSCRIPT),
      isPreset: false,
    });

    expect(card.analytics.questionTypes.open).toBeGreaterThan(0);
    expect(card.analytics.hasNextStep).toBe(true);
    expect(card.analytics.talkPercent).toBeGreaterThan(0);
  });
});
