import { describe, expect, it } from "vitest";
import {
  analyzeMeetingLogistics,
  buildLiveStateBlock,
  clientAcceptedMeeting,
  DATE_DEMAND_AFTER_ACCEPT,
  initialEmotionalMeters,
  repairDateDemandAfterAccept,
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
    expect(block).toMatch(/sin día y hora/);
  });

  it("accepts viernes a las 9 de la mañana after a presentation yes", () => {
    const turns = [
      {
        role: "trainee" as const,
        text: "Podemos hacer una presentación del tablero de visitas a caseta.",
      },
      {
        role: "client" as const,
        text: "Sí, adelante, pueden presentar.",
      },
    ];
    expect(clientAcceptedMeeting(turns)).toBe(true);

    const logistics = analyzeMeetingLogistics(
      turns,
      "¿Le parece el viernes a las 9 de la mañana?",
    );
    expect(logistics.presentationAccepted).toBe(true);
    expect(logistics.dayTimeMentioned).toBe(true);
    expect(logistics.shouldAcknowledgeSlot).toBe(true);

    const block = buildLiveStateBlock({
      meters: { confianza: 5, interes: 5, paciencia: 6 },
      logistics,
      turnNumber: 5,
      maxTurns: 5,
    });
    expect(block).toMatch(/Confirma ESE día y hora/);
    expect(block).not.toMatch(/Cita aceptada: no/);

    const demand =
      "Sin día y hora en mi agenda no hay revisión de caseta.";
    const repaired = repairDateDemandAfterAccept(
      demand,
      "viernes a las 9 de la mañana",
    );
    expect(repaired).toBeTruthy();
    expect(repaired).toMatch(/viernes/i);
    expect(repaired).not.toMatch(DATE_DEMAND_AFTER_ACCEPT);
  });

  it("does not treat a bare sí or si as meeting acceptance", () => {
    const offered = [
      {
        role: "trainee" as const,
        text: "Podemos hacer una presentación del tablero de visitas a caseta.",
      },
    ];
    expect(
      clientAcceptedMeeting([...offered, { role: "client", text: "Sí" }]),
    ).toBe(false);
    expect(
      clientAcceptedMeeting([...offered, { role: "client", text: "Si" }]),
    ).toBe(false);
    expect(
      clientAcceptedMeeting([...offered, { role: "client", text: "sí." }]),
    ).toBe(false);
    expect(
      clientAcceptedMeeting([
        ...offered,
        { role: "client", text: "Sí, adelante, pueden presentar." },
      ]),
    ).toBe(true);
  });

  it("does not treat time-only 9 de la mañana as an offered slot", () => {
    const turns = [
      {
        role: "trainee" as const,
        text: "Podemos hacer una presentación del tablero de visitas a caseta.",
      },
      {
        role: "client" as const,
        text: "Sí, adelante, pueden presentar.",
      },
    ];
    const timeOnly = analyzeMeetingLogistics(turns, "9 de la mañana");
    expect(timeOnly.presentationAccepted).toBe(true);
    expect(timeOnly.meetingAccepted).toBe(true);
    expect(timeOnly.dayTimeMentioned).toBe(false);
    expect(timeOnly.shouldAcknowledgeSlot).toBe(false);

    const noSlot = analyzeMeetingLogistics(
      turns,
      "Le mando el one-pager del tablero.",
    );
    expect(noSlot.meetingAccepted).toBe(true);
    expect(noSlot.shouldAcknowledgeSlot).toBe(false);

    const fakeDemand =
      "Sin día y hora en mi agenda no hay revisión de caseta.";
    expect(repairDateDemandAfterAccept(fakeDemand, "Le mando el one-pager.")).toBe(
      "Ese horario me sirve. Traiga el tablero de caseta, no un pitch.",
    );
  });
});
