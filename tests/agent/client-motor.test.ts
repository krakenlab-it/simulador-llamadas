import { describe, expect, it } from "vitest";
import {
  analyzeMeetingLogistics,
  buildLiveStateBlock,
  clientAcceptedMeeting,
  initialEmotionalMeters,
  updateEmotionalMeters,
} from "@/lib/agent/client-motor";

describe("live client motor", () => {
  it("starts meters from Jaime difficulty, not a generic 5/5/5", () => {
    expect(initialEmotionalMeters(1)).toEqual({
      confianza: 3,
      interes: 4,
      paciencia: 7,
    });
    expect(initialEmotionalMeters(3).paciencia).toBe(5);
  });

  it("rewards a named intro and punishes a long pitch", () => {
    const start = initialEmotionalMeters(1);
    const afterIntro = updateEmotionalMeters(
      start,
      "Buenos días, soy Ana, le llamo por las visitas a caseta. ¿Tiene un minuto?",
      "Escéptica, entre juntas",
      1,
    );
    expect(afterIntro.confianza).toBeGreaterThan(start.confianza);

    const afterPitch = updateEmotionalMeters(
      start,
      "Somos la mejor agencia y líderes en soluciones integrales. Le cuento todo el portafolio sin preguntarle nada: branding, pauta, retainer, workshops, un discurso muy largo sobre cómo operamos en todo el mercado nacional, los casos de éxito inventados, la garantía de resultados y por qué deberían firmar hoy mismo sin revisar su caseta ni su CAC ni su agenda de esta semana.",
      "Escéptica, entre juntas",
      1,
    );
    expect(afterPitch.interes).toBeLessThan(start.interes);
    expect(afterPitch.paciencia).toBeLessThanOrEqual(start.paciencia);
  });

  it("treats a granted meeting as granted and asks for logistics, not a second date", () => {
    const turns = [
      {
        role: "trainee" as const,
        text: "¿Le parece el jueves a las 10 para ver el tablero?",
      },
      {
        role: "client" as const,
        text: "Listo, quedamos. La reunión del jueves está agendada.",
      },
    ];
    expect(clientAcceptedMeeting(turns)).toBe(true);
    const logistics = analyzeMeetingLogistics(
      turns,
      "Le mando el correo para la invitación",
    );
    expect(logistics.meetingAccepted).toBe(true);
    expect(logistics.sellerAskingContact).toBe(true);

    const block = buildLiveStateBlock({
      meters: { confianza: 6, interes: 5, paciencia: 6 },
      logistics,
      turnNumber: 5,
      maxTurns: 5,
    });
    expect(block).toMatch(/ESTADO EN VIVO/);
    expect(block).toMatch(/Cita aceptada: sí/);
    expect(block).toMatch(/correo o WhatsApp/);
    expect(block).toMatch(/No pidas otra vez la fecha/);
  });
});
