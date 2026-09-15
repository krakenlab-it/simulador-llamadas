import { describe, expect, it } from "vitest";
import {
  analyzeMeetingLogistics,
  buildMeetingLogisticsLiveBlock,
  clientAcceptedMeeting,
  repairDateDemandAfterAccept,
  sellerAskingForContact,
} from "@/lib/agentic/meeting-logistics";
import { buildJaimeClientSystemPrompt } from "@/lib/agentic/jaime-prompt";
import { buildScenarioPack } from "@/lib/agentic/scenario-pack";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { initialEmotionalMeters } from "@/lib/agentic/emotional-meters";
import { getClientReply } from "@/lib/scoring/reactions";
import { normalizeMotorClientLine } from "@/lib/agentic/character-runtime";

describe("meeting logistics after acceptance", () => {
  const acceptedTurns = [
    { role: "client" as const, text: "¿Quién habla?" },
    { role: "trainee" as const, text: "Le propongo una videollamada de veinte minutos el jueves." },
    { role: "client" as const, text: "Va, agendemos la reunión." },
  ];

  it("detects client acceptance and seller contact request", () => {
    expect(clientAcceptedMeeting(acceptedTurns)).toBe(true);
    expect(sellerAskingForContact("¿Me comparte su correo para mandarle la invitación?")).toBe(true);

    const state = analyzeMeetingLogistics(
      acceptedTurns,
      "¿Me comparte su correo para mandarle la invitación?",
      false,
    );
    expect(state.meetingAccepted).toBe(true);
    expect(state.sellerAskingContact).toBe(true);
  });

  it("injects accepted-meeting guidance into ESTADO EN VIVO", () => {
    const config = buildScenarioConfig({
      industry: "restaurantes",
      productSold: "Marketing digital",
      clientProblem: "Mesas vacías",
      objections: ["No tengo tiempo"],
      winCriteria: "Cita agendada",
      temperament: "ocupado",
      clientName: "Ricardo Salazar",
    });
    const pack = buildScenarioPack(config, undefined, { clientName: "Ricardo Salazar" });

    const prompt = buildJaimeClientSystemPrompt({
      pack,
      config,
      clientName: "Ricardo Salazar",
      channel: "voz",
      difficultyLevel: 2,
      maxTurns: 10,
      recentTurns: acceptedTurns,
      traineeUtterance: "¿Me comparte su correo para la invitación?",
      meters: initialEmotionalMeters(2),
      turnNumber: 3,
      meetingAccepted: true,
    });

    expect(prompt).toContain("Cita aceptada por el cliente: sí");
    expect(prompt).toContain("sin fecha no hay reunión");
    expect(prompt).not.toContain("primero dígame qué día");
  });

  it("repairs date-demand lines after acceptance", () => {
    const repaired = repairDateDemandAfterAccept(
      "Si no hay fecha en la agenda, no hay reunión.",
      2,
    );
    expect(repaired).toMatch(/correo de la empresa|mismo número|asistente/i);
    expect(repaired?.toLowerCase()).not.toContain("sin fecha");
  });

  it("filters cierre bank lines that demand date after acceptance", () => {
    const priorLines = [
      { role: "client", text: "Va, queda la reunión." },
      { role: "trainee", text: "Perfecto, le mando la invitación." },
    ];

    const reply = getClientReply("mariana", "cierre", "medio", {
      sessionSeed: "accepted-cierre",
      turnNumber: 5,
      priorLines,
      channel: "voz",
    });

    expect(reply.toLowerCase()).not.toContain("sin fecha");
    expect(reply.toLowerCase()).not.toContain("no hay reunión");
  });

  it("sanitizes LLM date-demand output when meeting already accepted", () => {
    const config = buildScenarioConfig({
      industry: "Retail",
      productSold: "Medios",
      clientProblem: "Tráfico bajo",
      objections: ["Ya tengo agencia"],
      winCriteria: "Reunión",
      temperament: "Directo",
      clientName: "Rodrigo Nava",
    });
    const pack = buildScenarioPack(config, undefined, { clientName: "Rodrigo Nava" });

    const normalized = normalizeMotorClientLine(
      repairDateDemandAfterAccept("Sin día y hora concretos no hay reunión.", 1) ?? "",
      pack,
      "Rodrigo Nava",
    );

    expect(normalized.toLowerCase()).not.toContain("sin fecha");
    expect(normalized.toLowerCase()).not.toContain("no hay reunión");
  });

  it("builds live block that forbids re-asking date after accept", () => {
    const block = buildMeetingLogisticsLiveBlock({
      meetingAccepted: true,
      dayTimeMentioned: false,
      sellerAskingContact: true,
    });
    expect(block).toContain("colabora");
    expect(block).not.toContain("primero dígame");
  });
});
