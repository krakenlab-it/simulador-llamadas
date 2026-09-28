import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import {
  combinedPracticeDifficulty,
  difficultyLevelFromEtiqueta,
  normalizeDifficultyEtiqueta,
} from "@/lib/scenarios/difficulty-etiquette";
import {
  replyContainsAuthoringLeak,
  sanitizeLeakedBuyerReply,
} from "@/lib/scenarios/authoring-leak";
import { openingLineForCall } from "@/lib/scenarios/authoring";
import { buildPhonePickupOpening } from "@/lib/scenarios/phone-opening";
import { templateClientReply } from "@/lib/feedback/evaluation";
import { temperamentOptions } from "@/lib/scenarios/temperament-options";
import { buildDeterministicAuthoringAutofill } from "@/lib/scenarios/authoring-autofill";

describe("Jaime CC trainer pass", () => {
  it("lists at least 15 MX temperament options", () => {
    expect(temperamentOptions("es").length).toBeGreaterThanOrEqual(15);
  });

  it("normalizes legacy Media to Intermedio", () => {
    expect(normalizeDifficultyEtiqueta("Media", "es")).toBe("Intermedio");
    expect(difficultyLevelFromEtiqueta("Difícil", "es")).toBe(3);
  });

  it("combines hub level with case etiqueta using the harder level", () => {
    expect(combinedPracticeDifficulty(1, "Difícil", "es")).toBe(3);
    expect(combinedPracticeDifficulty(3, "Fácil", "es")).toBe(3);
  });

  it("builds phone pickup openings without embedding client problem text", () => {
    const config = buildScenarioConfig({
      industry: "marketing en Monterrey",
      productSold: "pauta",
      clientProblem: "Necesita generar mas clientes de una zona de gente con dinero",
      objections: ["No tengo presupuesto"],
      winCriteria: "Cita martes 10",
      temperament: "Escéptico",
      clientName: "Andrés",
      companyContext: "Agencia en Monterrey",
      language: "es",
    });
    const opening = config.openingLines[0];
    expect(opening.toLowerCase()).not.toContain("necesita generar");
    expect(opening).toMatch(/buenas|buenos|dígame|quién habla/i);
  });

  it("repairs legacy leaked opening lines at call time", () => {
    const problem =
      "Necesita generar mas clientes de una zona de gente con dinero";
    const config = buildScenarioConfig({
      industry: "retail",
      productSold: "ads",
      clientProblem: problem,
      objections: [],
      winCriteria: "Cita",
      temperament: "Escéptico",
      clientName: "Laura",
      language: "es",
    });
    const leaked = `¿Quién habla? Estoy ocupado con ${problem}.`;
    const line = openingLineForCall(
      { ...config, openingLines: [leaked] },
      false,
    );
    expect(line.toLowerCase()).not.toContain("necesita generar");
  });

  it("sanitizes template replies that paste authoring text", () => {
    const config = buildScenarioConfig({
      industry: "gimnasio",
      productSold: "membresía",
      clientProblem: "Baja retención en sucursal norte",
      objections: ["Ya tenemos app"],
      winCriteria: "Visita",
      temperament: "Escéptico",
      clientName: "Laura",
      language: "es",
    });
    const leaked = templateClientReply(
      config,
      config.rounds[0],
      "bien",
      "Laura",
    );
    expect(leaked.toLowerCase()).not.toContain("baja retención");
    const bad = `Hable de ${config.clientProblem} con datos.`;
    expect(replyContainsAuthoringLeak(bad, config)).toBe(true);
    expect(sanitizeLeakedBuyerReply(bad, config, "es")).toMatch(/quién habla/i);
  });

  it("autofill produces coach pressure fields, not verbatim problem dumps", () => {
    const patch = buildDeterministicAuthoringAutofill({
      industry: "inmobiliaria CDMX",
      productSold: "visitas al local",
      clientName: "Mariana",
      clientTitle: "Gerente",
      companyContext: "Desarrollo en CDMX",
      clientProblem: "Locales vacíos en zona premium",
      language: "es",
      callType: "fria",
    });
    expect(patch.rounds?.length).toBeGreaterThanOrEqual(3);
    const joined = (patch.rounds ?? [])
      .map((round) => round.clientPrompt)
      .join(" ");
    expect(joined.toLowerCase()).not.toContain("locales vacíos en zona premium");
  });

  it("infers regional greeting from city context", () => {
    const line = buildPhonePickupOpening({
      companyContext: "Sucursal Monterrey",
      language: "es",
    });
    expect(line).toMatch(/dígame|quién habla/i);
  });
});
