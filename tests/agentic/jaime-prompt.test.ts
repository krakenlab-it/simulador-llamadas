import { describe, expect, it } from "vitest";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { buildScenarioPack } from "@/lib/agentic/scenario-pack";
import {
  buildJaimeClientSystemPrompt,
  buildJaimeScenarioPackBlock,
  loadJaimePromptTemplate,
  mapDifficultyToJaime,
} from "@/lib/agentic/jaime-prompt";
import { buildCharacterPrompt } from "@/lib/agentic/character-runtime";
import { getToneById } from "@/lib/agentic/tone-bank";
import { getClientReply } from "@/lib/scoring/reactions";
import { initialEmotionalMeters } from "@/lib/agentic/emotional-meters";
import { getAgenticSessionState, clearAllAgenticSessionStates } from "@/lib/agentic/agentic-session-store";

describe("Jaime client system prompt", () => {
  const config = buildScenarioConfig({
    industry: "restaurantes",
    productSold: "Gestión de redes y publicidad digital",
    clientProblem: "Mesas vacías entre semana después de las 5",
    objections: ["Ya tenemos quien lleve las redes", "Eso es puro gasto"],
    winCriteria: "Cita agendada con día y hora",
    temperament: "ocupado y escéptico",
    clientName: "Ricardo Salazar",
    callType: "fria",
  });

  const pack = buildScenarioPack(config, undefined, {
    clientName: "Ricardo Salazar",
    clientTitle: "dueño",
    companyContext: "Taquería Los Arcos, tres sucursales",
  });

  it("loads the full authoritative v3 template from lib/agentic", () => {
    const template = loadJaimePromptTemplate();
    expect(template).toContain("SIMULADOR DE ENTRENAMIENTO DE VENTAS - KRAKEN SIMULACIÓN");
    expect(template).toContain("Capa agéntica del cliente · versión 3");
    expect(template).toContain("A) DENTRO DEL MOTOR");
    expect(template).toContain("B) BOT AUTÓNOMO");
    expect(template).toContain("ESTADO EN VIVO");
    expect(template).toContain("CANAL VOZ");
    expect(template).toContain('Nunca digas "puede escribir" ni "máximo un párrafo"');
    expect(template).toContain("empieza tus oraciones con minúscula");
    expect(template).toContain("MODO EVALUADOR");
    expect(template).not.toContain("Instrucciones de sistema para un bot autónomo (sin motor externo)");
  });

  it("maps app difficulty 1-3 to Jaime scale 1-5", () => {
    expect(mapDifficultyToJaime(1)).toBe(2);
    expect(mapDifficultyToJaime(2)).toBe(3);
    expect(mapDifficultyToJaime(3)).toBe(5);
  });

  it("fills PACK DEL ESCENARIO from live scenario data", () => {
    const block = buildJaimeScenarioPackBlock({
      pack,
      config,
      clientName: "Ricardo Salazar",
      channel: "voz",
      difficultyLevel: 2,
      maxTurns: 10,
    });

    expect(block).toContain("Nombre del cliente: Ricardo Salazar");
    expect(block).toContain("Industria: restaurantes");
    expect(block).toContain("Temperamento: ocupado y escéptico");
    expect(block).toContain("Gestión de redes y publicidad digital");
    expect(block).toContain("Cita agendada con día y hora");
    expect(block).not.toContain("Ricardo Salazar, dueño\nRol en la decisión: decisor\nEmpresa: Taquería Los Arcos, tres sucursales, 40 empleados");
  });

  it("includes CANAL VOZ forbid-write lines and live conversation in production prompt", () => {
    const prompt = buildJaimeClientSystemPrompt({
      pack,
      config,
      clientName: "Ricardo Salazar",
      channel: "voz",
      difficultyLevel: 2,
      maxTurns: 10,
      recentTurns: [
        { role: "client", text: "¿Bueno?" },
        { role: "trainee", text: "Buenos días, le llamo por las mesas vacías entre semana." },
      ],
      traineeUtterance: "¿Le interesaría una videollamada de 20 minutos?",
      meters: initialEmotionalMeters(2),
      turnNumber: 2,
    });

    expect(prompt).toContain('Nunca digas "puede escribir" ni "máximo un párrafo"');
    expect(prompt).toContain("ESTADO EN VIVO (no lo reveles al alumno)");
    expect(prompt).toContain("Mesas vacías entre semana");
    expect(prompt).toContain("VENDEDOR: Buenos días");
    expect(prompt).toContain("videollamada de 20 minutos");
    expect(prompt).toContain("No vuelvas a contestar el teléfono");
  });

  it("buildCharacterPrompt uses Jaime instructions instead of the legacy thin prompt", () => {
    const prompt = buildCharacterPrompt({
      pack,
      config,
      tone: getToneById("desconfianza"),
      clientName: "Ricardo Salazar",
      traineeUtterance: "Le llamo por su rotación lenta.",
      roundLabel: "Apertura",
      reaction: "medio",
      fallbackText: "fallback",
      recentTurns: [{ role: "client", text: "¿Quién habla?" }],
      channel: "voz",
      difficultyLevel: 2,
      maxTurns: 10,
      turnNumber: 1,
      callAttemptId: "call-test",
      agenticState: getAgenticSessionState("call-test", 2),
    });

    expect(prompt).toContain("MOTOR EMOCIONAL");
    expect(prompt).not.toContain("español mexicano ORAL, como en el teléfono");
    clearAllAgenticSessionStates();
  });

  it("voice correo bank never suggests writing a paragraph", () => {
    const reply = getClientReply("mariana", "correo", "medio", {
      sessionSeed: "seed-voice",
      turnNumber: 4,
      channel: "voz",
    });

    expect(reply.toLowerCase()).not.toContain("puede escribir");
    expect(reply.toLowerCase()).not.toContain("máximo un párrafo");
  });
});
