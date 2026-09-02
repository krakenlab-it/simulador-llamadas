import { describe, expect, it, beforeEach } from "vitest";
import {
  stubCreateScenario,
  stubCreateSession,
  stubEndSession,
  stubListScenarios,
  stubSubmitTurn,
  stubUpdateScenario,
  resetStubSessions,
} from "@/lib/api/stubs";

describe("custom scenario stubs", () => {
  beforeEach(() => {
    resetStubSessions();
  });

  it("creates and runs a custom scenario session with rich evaluation", async () => {
    const scenario = stubCreateScenario({
      industry: "gimnasio",
      productSold: "membresía anual",
      clientName: "Laura Méndez",
      clientTitle: "Gerente",
      companyContext: "Cadena de gimnasios",
      temperament: "Impaciente",
      difficultyLabel: "Media",
      clientProblem: "baja retención de socios",
      objections: ["Muy caro"],
      winCriteria: "SPIN Advance: visita con acción concreta",
    });

    const session = stubCreateSession({
      scenarioSlug: scenario.slug,
      mode: "texto",
      difficultyLevel: 2,
    });

    expect(session.isPreset).toBe(false);
    expect(session.totalRounds).toBe(5);

    const turn = await stubSubmitTurn(session.callAttemptId, {
      utterance:
        "Entiendo la retención en su gimnasio. ¿Qué ha probado y qué resultado vio?",
    });

    expect(turn.richFeedback.whyScore).toBeTruthy();
    expect(turn.richFeedback.analytics).toBeDefined();

    const ended = await stubEndSession(session.callAttemptId);
    expect(ended.evaluation).toBeDefined();
    expect(ended.evaluation.nextDrill).toBeTruthy();
    expect(ended.evaluation.scorecard).toBeDefined();
    expect(ended.totalRounds).toBe(5);
  });

  it("updates success criteria on a custom scenario and keeps the slug", () => {
    const created = stubCreateScenario({
      industry: "banco",
      productSold: "cuenta pyme",
      clientName: "Ana Soto",
      clientTitle: "Gerente",
      companyContext: "Banco Sur",
      temperament: "Directa",
      difficultyLabel: "Media",
      clientProblem: "filas largas",
      objections: ["Ya tenemos core"],
      winCriteria: "Cita en sucursal",
      language: "es",
      callType: "discovery",
    });

    const updated = stubUpdateScenario({
      slug: created.slug,
      industry: created.industry ?? "banco",
      productSold: created.productSold ?? "cuenta pyme",
      clientName: created.clientName,
      clientTitle: created.clientTitle,
      companyContext: created.companyContext,
      temperament: created.temperament ?? "Directa",
      difficultyLabel: created.difficultyLabel,
      clientProblem: created.clientProblem ?? "filas largas",
      objections: created.objections,
      winCriteria: "SPIN Advance: mesa de trabajo el viernes a las 11",
      language: "es",
      callType: "cierre",
      dimensionGuides: {
        cierre_siguiente_paso: "Agenda mesa de trabajo con hora.",
      },
    });

    expect(updated.slug).toBe(created.slug);
    expect(updated.winCriteria).toBe(
      "SPIN Advance: mesa de trabajo el viernes a las 11",
    );
    expect(updated.config.callType).toBe("cierre");
    expect(updated.config.dimensionGuides?.cierre_siguiente_paso).toContain(
      "mesa de trabajo",
    );
    expect(stubListScenarios().some((s) => s.slug === created.slug)).toBe(true);
  });
});
