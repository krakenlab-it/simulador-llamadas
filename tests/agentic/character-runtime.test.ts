import { describe, expect, it } from "vitest";
import { buildScenarioPack } from "@/lib/agentic/scenario-pack";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import {
  buildCharacterPrompt,
  templateCharacterReply,
} from "@/lib/agentic/character-runtime";
import { getToneById } from "@/lib/agentic/tone-bank";

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

  it("includes recent thread text in the production prompt", () => {
    const prompt = buildCharacterPrompt({
      pack,
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
    });

    expect(prompt).toContain("CONVERSACIÓN HASTA AHORA");
    expect(prompt).toContain("¿Quién habla? Tengo dos minutos.");
    expect(prompt).toContain("español mexicano ORAL");
    expect(prompt).toContain("caseta no convierte");
    expect(prompt).toContain("Eso no mueve venta por m²");
  });

  it("varies template fallbacks for different trainee utterances", () => {
    const base = {
      pack,
      tone,
      clientName: "Rodrigo Nava",
      roundLabel: "Objeción",
      reaction: "mal" as const,
      fallbackText: "",
      recentTurns: [{ role: "client" as const, text: "Dígame rápido." }],
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
    expect(replyA.toLowerCase()).toMatch(/mire|oiga|no manches/);
    expect(replyB).toContain("caseta");
  });
});
