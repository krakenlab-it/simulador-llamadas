import { describe, expect, it } from "vitest";
import {
  buildUniversalClinicSystemFrame,
  UNIVERSAL_CLINIC_CAPACITADOR_NOTE,
  powerfulQuestionHintForPhase,
} from "@/lib/agent/clinic-frame";
import { CLIENT_LAYER_ENGINES } from "@/lib/agent/client-layer";
import {
  AI_OR_SCENARIO_LEAK,
  analyzeBuyerPsych,
  buildBuyerRoleLock,
} from "@/lib/agent/buyer-psych";
import { buildImpersonationRoles } from "@/lib/agent/impersonation";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";

describe("clinic cold-call framing", () => {
  it("documents capacitador IA defaults without telling the buyer to leak", () => {
    expect(UNIVERSAL_CLINIC_CAPACITADOR_NOTE).toMatch(/llamada en frío/i);
    expect(UNIVERSAL_CLINIC_CAPACITADOR_NOTE).toMatch(/preguntas poderosas/i);
    expect(UNIVERSAL_CLINIC_CAPACITADOR_NOTE).toMatch(/sin decir nunca/i);
  });

  it("ships strengthened default engine card copy", () => {
    const grounding = CLIENT_LAYER_ENGINES.find((e) => e.id === "grounding");
    const dialogo = CLIENT_LAYER_ENGINES.find((e) => e.id === "dialogo");
    expect(grounding?.body).toMatch(/pack/i);
    expect(grounding?.body).toMatch(/clínica/i);
    expect(dialogo?.body).toMatch(/pregunta poderosa/i);
    expect(dialogo?.body).toMatch(/no un cuestionario/i);
  });

  it("adds system-only clinic frame and role lock without spoken simulation admission", () => {
    const frame = buildUniversalClinicSystemFrame();
    expect(frame).toMatch(/MARCO INTERNO/i);
    expect(frame).toMatch(/llamada en frío/i);
    expect(frame).toMatch(/pregunta poderosa/i);
    expect(frame).toMatch(/NUNCA lo dice en voz alta/i);

    const state = analyzeBuyerPsych({
      traineeUtterance: "Buenos días, le llamo de Kraken.",
      roundNumber: 1,
      scenarioSlug: "mariana",
    });
    const role = buildBuyerRoleLock({
      name: "Mariana",
      state,
    });
    expect(role).toMatch(/Llamada en frío/i);
    expect(role).toMatch(/pregunta poderosa/i);
    expect(role).not.toMatch(/di que es una simulación/i);
    expect(role).toMatch(/admitir IA/i);

    expect(AI_OR_SCENARIO_LEAK.test("esto es una simulación")).toBe(true);
    expect(AI_OR_SCENARIO_LEAK.test("solo estamos entrenando")).toBe(true);
    expect(AI_OR_SCENARIO_LEAK.test("¿Quién habla?")).toBe(false);
  });

  it("injects clinic frame into impersonation system role", () => {
    const config = buildPresetScenarioConfig("mariana");
    const roles = buildImpersonationRoles({
      config: config!,
      round: config!.rounds[0],
      reaction: "medio",
      clientName: "Mariana Escobedo",
      traineeUtterance: "Buenos días",
      roundNumber: 1,
      scenarioSlug: "mariana",
    });
    expect(roles.agent).toMatch(/MARCO INTERNO/i);
    expect(roles.agent).toMatch(/Hechos del caso:/);
  });

  it("hints powerful questions only in early phases", () => {
    expect(powerfulQuestionHintForPhase("opening_id", "¿Qué resultado medible?")).toMatch(
      /poderosa/i,
    );
    expect(powerfulQuestionHintForPhase("closing")).toBeNull();
  });
});
