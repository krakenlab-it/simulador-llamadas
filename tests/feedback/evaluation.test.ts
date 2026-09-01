import { describe, expect, it } from "vitest";
import { buildSessionEvaluation } from "@/lib/feedback/evaluation";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";

describe("session evaluation feedback", () => {
  const config = buildScenarioConfig({
    industry: "seguros",
    productSold: "póliza de auto",
    clientProblem: "siniestralidad alta",
    objections: ["Muy caro"],
    winCriteria: "Cita con día y hora",
    temperament: "Escéptico",
    clientName: "Ana",
  });

  it("builds verdict, strongest/weakest, and next drill", () => {
    const evaluation = buildSessionEvaluation(
      [
        { roundKey: "apertura", roundLabel: "Apertura", roundScore: 70 },
        { roundKey: "objecion", roundLabel: "Objeción", roundScore: 30 },
        { roundKey: "cierre", roundLabel: "Cierre", roundScore: 55 },
      ],
      false,
      config,
      [],
    );

    expect(evaluation.verdict.toLowerCase()).toContain("objeción");
    expect(evaluation.strongestRound.label).toBe("Apertura");
    expect(evaluation.weakestRound.label).toBe("Objeción");
    expect(evaluation.nextDrill).toContain("Objeción");
  });

  it("detects improving trend across attempts", () => {
    const evaluation = buildSessionEvaluation(
      [{ roundKey: "cierre", roundLabel: "Cierre", roundScore: 80 }],
      true,
      config,
      [
        { totalScore: 45, startedAt: "2026-01-01" },
        { totalScore: 55, startedAt: "2026-01-02" },
        { totalScore: 70, startedAt: "2026-01-03" },
      ],
    );

    expect(evaluation.trend).not.toBeNull();
    expect(evaluation.trend?.attempts).toBe(3);
    expect(evaluation.trend?.improving).toBe(true);
    expect(evaluation.trend?.showStableLabel).toBe(false);
  });
});
