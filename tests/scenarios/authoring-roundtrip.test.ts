import { describe, expect, it } from "vitest";
import {
  applyLanguageDefaults,
  buildAuthoredScenarioConfig,
  draftFromRecord,
  draftToCreateInput,
  draftToUpdateInput,
  emptyAuthoringDraft,
  parseAuthoringBody,
  scoringPhaseCount,
  validateAuthoringDraft,
} from "@/lib/scenarios/authoring";
import { SCORE_DIMENSIONS } from "@/lib/scoring/dimensions";
import { inferCallType } from "@/lib/scoring/outcome";
import { scoreTranscriptHeuristic } from "@/lib/scoring/heuristic-scorecard";
import { isClinicPreset } from "@/lib/scenarios/types";
import type { ScenarioRecord } from "@/lib/scenarios/types";

function filledDraft() {
  const draft = emptyAuthoringDraft("es");
  return {
    ...draft,
    industry: "taller de llantas",
    productSold: "llantas premium",
    clientName: "Carlos Ruiz",
    clientTitle: "Dueño",
    companyContext: "Taller Norte",
    clientProblem: "rotación lenta en temporada baja",
    objections: ["Ya tengo proveedor", "Márgenes apretados"],
    winCriteria: "Visita al taller el martes a las 10",
    callType: "discovery" as const,
  };
}

function recordFromDraft(slug = "carlos-taller"): ScenarioRecord {
  const input = draftToCreateInput(filledDraft());
  const config = buildAuthoredScenarioConfig(input);
  return {
    id: "scenario-1",
    slug,
    isPreset: false,
    clientName: input.clientName,
    clientTitle: input.clientTitle,
    companyContext: input.companyContext,
    difficultyLabel: input.difficultyLabel,
    indicator: input.winCriteria.slice(0, 80),
    painPoints: [input.clientProblem, ...input.objections],
    industry: input.industry,
    productSold: input.productSold,
    temperament: input.temperament,
    clientProblem: input.clientProblem,
    objections: input.objections,
    winCriteria: input.winCriteria,
    language: "es",
    config,
  };
}

describe("scenario authoring create/edit round-trip", () => {
  it("creates a draft with persona, language, beats, and KLM-50 guides", () => {
    const draft = filledDraft();
    expect(validateAuthoringDraft(draft)).toBeNull();
    expect(draft.language).toBe("es");
    expect(draft.rounds.length).toBe(5);
    expect(draft.rounds[0].label).toBe("Apertura");
    expect(Object.keys(draft.dimensionGuides)).toHaveLength(
      SCORE_DIMENSIONS.length,
    );

    const created = draftToCreateInput(draft);
    expect(created.winCriteria).toBe("Visita al taller el martes a las 10");
    expect(created.language).toBe("es");
    expect(created.callType).toBe("discovery");
    expect(created.rounds).toHaveLength(5);
    expect(created.dimensionGuides?.cierre_siguiente_paso).toMatch(/día y hora/);
  });

  it("round-trips success criteria and dimension guides through edit", () => {
    const created = recordFromDraft();
    const loaded = draftFromRecord(created);
    expect(loaded.winCriteria).toBe("Visita al taller el martes a las 10");
    expect(loaded.language).toBe("es");
    expect(loaded.callType).toBe("discovery");
    expect(loaded.rounds[2].goal).toBeTruthy();

    const edited = {
      ...loaded,
      winCriteria: "SPIN Advance: demo en piso el jueves a las 9",
      callType: "cierre" as const,
      dimensionGuides: {
        ...loaded.dimensionGuides,
        cierre_siguiente_paso: "Agenda demo en el taller con día y hora.",
      },
      rounds: loaded.rounds.map((round, index) =>
        index === 4
          ? { ...round, whatGoodLooksLike: "Propone visita con hora fija." }
          : round,
      ),
    };

    const update = draftToUpdateInput(created.slug, edited);
    expect(update.slug).toBe("carlos-taller");
    expect(update.winCriteria).toBe(
      "SPIN Advance: demo en piso el jueves a las 9",
    );
    expect(update.callType).toBe("cierre");
    expect(update.dimensionGuides?.cierre_siguiente_paso).toContain("demo");
    expect(update.rounds?.[4]?.whatGoodLooksLike).toContain("hora fija");

    const nextConfig = buildAuthoredScenarioConfig(update);
    expect(nextConfig.winCriteria).toBe(update.winCriteria);
    expect(nextConfig.callType).toBe("cierre");
    expect(nextConfig.dimensionGuides?.cierre_siguiente_paso).toContain("demo");
    expect(inferCallType(nextConfig, false)).toBe("cierre");
  });

  it("rejects incomplete drafts and clinic preset slugs stay presets", () => {
    const empty = emptyAuthoringDraft();
    expect(validateAuthoringDraft(empty)).toMatch(/Falta/);
    expect(isClinicPreset("mariana")).toBe(true);
    expect(isClinicPreset("carlos-taller")).toBe(false);

    const parsed = parseAuthoringBody({
      industry: "banco",
      productSold: "",
      clientName: "Ana",
      clientTitle: "Gerente",
      companyContext: "Banco Sur",
      temperament: "Directa",
      clientProblem: "filas largas",
      winCriteria: "Cita en sucursal",
    });
    expect(parsed.ok).toBe(false);
  });

  it("keeps authored beat count for the live call, clinic stays at 5", () => {
    const draft = filledDraft();
    draft.rounds = draft.rounds.slice(0, 4);
    const config = buildAuthoredScenarioConfig(draftToCreateInput(draft));
    expect(scoringPhaseCount(config, false)).toBe(4);
    expect(scoringPhaseCount(null, true)).toBe(5);
  });

  it("reuses the KLM-50 six-dimension card instead of a second scorecard", () => {
    const config = buildAuthoredScenarioConfig(draftToCreateInput(filledDraft()));
    const card = scoreTranscriptHeuristic({
      lines: [
        { role: "client", text: "¿Quién habla? Ya tengo proveedor." },
        {
          role: "trainee",
          text: "Entiendo la rotación lenta. ¿Qué ha probado y qué resultado vio? ¿Le parece el martes a las 10 en el taller?",
        },
      ],
      config,
      isPreset: false,
    });
    expect(card.dimensions.map((d) => d.id)).toEqual(
      SCORE_DIMENSIONS.map((d) => d.id),
    );
    expect(card.callType).toBe("discovery");
  });

  it("swaps default copy when the client language changes", () => {
    const blank = applyLanguageDefaults(emptyAuthoringDraft("es"), "en");
    expect(blank.language).toBe("en");
    expect(blank.winCriteria).toMatch(/SPIN Advance/);
    expect(blank.dimensionGuides.discovery_escucha).toMatch(/open questions/i);

    const custom = applyLanguageDefaults(filledDraft(), "en");
    expect(custom.winCriteria).toBe("Visita al taller el martes a las 10");
    expect(custom.dimensionGuides.discovery_escucha).toMatch(/open questions/i);
  });
});
