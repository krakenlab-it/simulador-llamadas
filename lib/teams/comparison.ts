import type { TeamComparisonView } from "@/lib/agent/types";
import { getCatalogPreset } from "@/lib/scenarios/catalog-presets";

export function buildDeterministicComparison(input: {
  teamName: string;
  teamId: string;
  testId: string;
  scenarioSlug: string;
  title: string;
  members: Array<{
    memberId: string;
    displayName: string;
    totalScore: number;
    won: boolean;
    turnsCompleted: number;
  }>;
}): TeamComparisonView {
  const ranked = [...input.members].sort((a, b) => b.totalScore - a.totalScore);
  const leader = ranked[0] ?? null;
  const gaps: string[] = [];
  const coaching: string[] = [];
  const preset = getCatalogPreset(input.scenarioSlug);

  if (ranked.length < 2) {
    gaps.push("Falta al menos un segundo resultado para comparar el mismo examen.");
  } else {
    const spread = ranked[0].totalScore - ranked[ranked.length - 1].totalScore;
    gaps.push(
      `La diferencia entre ${ranked[0].displayName} y ${ranked[ranked.length - 1].displayName} es ${spread} puntos.`,
    );
    const winners = ranked.filter((item) => item.won);
    if (winners.length === 0) {
      gaps.push("Nadie cerró con día y hora. El examen todavía no tiene un avance SPIN.");
    } else if (winners.length < ranked.length) {
      gaps.push(
        `${winners.map((item) => item.displayName).join(", ")} sí agendó; el resto no.`,
      );
    }
  }

  if (preset) {
    coaching.push(
      `Mismo caso (${preset.name}): hablen el indicador «${preset.indicator}», no un pitch genérico.`,
    );
    coaching.push(`Éxito del examen: ${preset.winCriteria}`);
  } else {
    coaching.push("Repitan el mismo escenario. No comparen casos distintos.");
  }

  if (leader && ranked.length > 1) {
    coaching.push(
      `${leader.displayName} lidera con ${leader.totalScore}. El resto ensaya el mismo cierre con día y hora.`,
    );
  }

  const narrative =
    ranked.length === 0
      ? `El equipo ${input.teamName} todavía no cargó resultados en «${input.title}».`
      : ranked.length === 1
        ? `${ranked[0].displayName} ya hizo «${input.title}» (${ranked[0].totalScore} pts). Agrega otro miembro al mismo examen para comparar.`
        : `${input.teamName} comparó el mismo examen «${input.title}». ${leader?.displayName ?? "Nadie"} va adelante. ${gaps[0] ?? ""}`;

  return {
    teamId: input.teamId,
    teamName: input.teamName,
    testId: input.testId,
    scenarioSlug: input.scenarioSlug,
    title: input.title,
    members: ranked,
    leaderName: leader?.displayName ?? null,
    gaps,
    coaching,
    narrative: narrative.trim(),
  };
}
