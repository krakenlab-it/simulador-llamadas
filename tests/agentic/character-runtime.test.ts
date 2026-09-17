import { describe, expect, it, vi, afterEach } from "vitest";
import { buildScenarioPack } from "@/lib/agentic/scenario-pack";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import {
  AGENTIC_LLM_UNAVAILABLE_REPLY,
  buildCharacterPrompt,
  generateCharacterReply,
  normalizeMotorClientLine,
  templateCharacterReply,
} from "@/lib/agentic/character-runtime";
import * as llmProvider from "@/lib/llm/provider";
import { getToneById } from "@/lib/agentic/tone-bank";
import { getAgenticSessionState, clearAllAgenticSessionStates } from "@/lib/agentic/agentic-session-store";

describe("agentic character runtime", () => {
  const config = buildScenarioConfig({
    industry: "Retail",
    productSold: "Medios para tráfico a tienda",
    clientProblem: "Ventas por metro cuadrado bajas",
    objections: ["Eso no mueve venta por m²", "Ya tengo agencia"],
    winCriteria: "Reunión con día y hora",
    temperament: "Directo, sin tiempo",
    clientName: "Rodrigo Nava",
  });

  const pack = buildScenarioPack(config, undefined, {
    clientName: "Rodrigo Nava",
    clientTitle: "Director comercial",
    companyContext: "Cadena de tiendas departamentales",
  });

  const tone = getToneById("desconfianza");
  const agenticState = getAgenticSessionState("runtime-test", 2);

  it("includes recent thread and Jaime CANAL VOZ rules in the production prompt", () => {
    const prompt = buildCharacterPrompt({
      pack,
      config,
      tone,
      clientName: "Rodrigo Nava",
      traineeUtterance:
        "Le llamo porque vimos que su tráfico a tienda cayó y la caseta no convierte.",
      roundLabel: "Apertura",
      reaction: "medio",
      fallbackText: "fallback",
      recentTurns: [
        { role: "client", text: "¿Quién habla? Tengo dos minutos." },
        {
          role: "trainee",
          text: "Buenos días, soy Ana de Kraken Lab.",
        },
      ],
      channel: "voz",
      difficultyLevel: 2,
      maxTurns: 10,
      turnNumber: 2,
      callAttemptId: "runtime-test",
      agenticState,
    });

    expect(prompt).toContain("CONVERSACIÓN COMPLETA HASTA AHORA");
    expect(prompt).toContain("¿Quién habla? Tengo dos minutos.");
    expect(prompt).toContain('Nunca digas "puede escribir" ni "máximo un párrafo"');
    expect(prompt).toContain("caseta no convierte");
    expect(prompt).toContain("Eso no mueve venta por m²");
    clearAllAgenticSessionStates();
  });

  it("varies template fallbacks for different trainee utterances", () => {
    const base = {
      pack,
      config,
      tone,
      clientName: "Rodrigo Nava",
      roundLabel: "Objeción",
      reaction: "mal" as const,
      fallbackText: "",
      recentTurns: [{ role: "client" as const, text: "Dígame rápido." }],
      channel: "voz" as const,
      difficultyLevel: 2 as const,
      maxTurns: 10,
      turnNumber: 2,
      callAttemptId: "runtime-test-2",
      agenticState: getAgenticSessionState("runtime-test-2", 2),
    };

    const replyA = templateCharacterReply({
      ...base,
      traineeUtterance: "Tenemos un plan de medios omnicanal con KPIs de visita.",
    });
    const replyB = templateCharacterReply({
      ...base,
      traineeUtterance: "Podemos subir el tráfico a piso con activaciones en caseta.",
    });

    expect(replyA).not.toBe(replyB);
    expect(replyA.toLowerCase()).toMatch(/mire|oiga/);
    clearAllAgenticSessionStates();
  });

  it("lowercases motor sentence starts except pack proper names", () => {
    const normalized = normalizeMotorClientLine(
      "Ahorita no puedo. Rodrigo Nava está en reunión.",
      pack,
      "Rodrigo Nava",
    );
    expect(normalized).toMatch(/^ahorita no puedo/i);
    expect(normalized).toContain("Rodrigo Nava");
  });

  it("fails visibly when agentic is required but no LLM key is configured", async () => {
    vi.spyOn(llmProvider, "isLlmAvailable").mockReturnValue(false);

    const result = await generateCharacterReply({
      pack,
      config,
      tone,
      clientName: "Rodrigo Nava",
      traineeUtterance: "Le llamo por su tráfico a tienda.",
      roundLabel: "Apertura",
      reaction: "medio",
      fallbackText: "plantilla clínica",
      recentTurns: [{ role: "client", text: "¿Quién habla?" }],
      channel: "voz",
      difficultyLevel: 2,
      maxTurns: 10,
      turnNumber: 2,
      callAttemptId: "runtime-test-3",
      agenticState: getAgenticSessionState("runtime-test-3", 2),
      agenticRequired: true,
    });

    expect(result.agenticError).toBe(true);
    expect(result.reply).toContain(AGENTIC_LLM_UNAVAILABLE_REPLY);
    expect(result.reply).not.toContain("plantilla clínica");
    clearAllAgenticSessionStates();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearAllAgenticSessionStates();
  });
});
