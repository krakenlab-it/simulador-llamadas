import { describe, expect, it } from "vitest";
import {
  buildImpersonationRoles,
  generateImpersonatedReply,
  isCloneReply,
} from "@/lib/agent/impersonation";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";

describe("impersonation", () => {
  it("separates buyer role from seller and packs this client's questions", () => {
    const config = buildPresetScenarioConfig("mariana");
    expect(config).not.toBeNull();
    const roles = buildImpersonationRoles({
      config: config!,
      round: config!.rounds[0],
      reaction: "medio",
      clientName: "Mariana Escobedo",
      traineeUtterance: "Buenos días, le llamo de Kraken.",
      roundNumber: 1,
      scenarioSlug: "mariana",
      recentReplies: ["Ya tenemos agencia y caseta."],
    });
    expect(roles.agent).toMatch(/Mariana Escobedo/);
    expect(roles.agent).toMatch(/Nunca hables como el vendedor/);
    expect(roles.agent).toMatch(/decisor/);
    expect(roles.user).toMatch(/vendedor/);
    expect(roles.context).toMatch(/PACK DEL ESCENARIO/);
    expect(roles.context).toMatch(/ESTADO EN VIVO/);
    expect(roles.context).toMatch(/caseta/i);
    expect(roles.context).not.toBe(roles.agent);
  });

  it("keeps a granted meeting granted and does not re-ask the day", () => {
    const config = buildPresetScenarioConfig("mariana");
    const roles = buildImpersonationRoles({
      config: config!,
      round: config!.rounds[4] ?? config!.rounds[0],
      reaction: "bien",
      clientName: "Mariana Escobedo",
      traineeUtterance: "Le mando el correo para la invitación",
      roundNumber: 5,
      scenarioSlug: "mariana",
      priorTurns: [
        {
          role: "trainee",
          text: "¿Le parece el jueves a las 10 para ver el tablero de caseta?",
        },
        {
          role: "client",
          text: "Listo, quedamos el jueves a las 10. La reunión está agendada.",
        },
      ],
    });
    expect(roles.agent).toMatch(/Ya aceptaste la cita/);
    expect(roles.context).toMatch(/Cita aceptada: sí/);
    expect(roles.context).toMatch(/correo o WhatsApp/);
  });

  it("returns the scripted line when the trainer turns the motor off", async () => {
    const config = buildPresetScenarioConfig("mariana");
    const text = await generateImpersonatedReply(
      {
        config: config!,
        round: config!.rounds[0],
        reaction: "medio",
        clientName: "Mariana Escobedo",
        traineeUtterance: "Buenos días",
        roundNumber: 1,
        scenarioSlug: "mariana",
        clientLayer: { motorEnabled: false, toneId: "auto" },
      },
      "Ya tenemos agencia y caseta.",
    );
    expect(text).toBe("Ya tenemos agencia y caseta.");
  });

  it("detects clone replies", () => {
    expect(isCloneReply("ok", [])).toBe(true);
    expect(
      isCloneReply("Ya tenemos agencia y caseta.", [
        "Ya tenemos agencia y caseta.",
      ]),
    ).toBe(true);
    expect(
      isCloneReply("El sábado necesito gente en piso, no clics.", [
        "Ya tenemos agencia y caseta.",
      ]),
    ).toBe(false);
  });
});
