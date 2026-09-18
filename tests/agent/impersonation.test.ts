import { describe, expect, it } from "vitest";
import {
  buildImpersonationRoles,
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
    expect(roles.user).toMatch(/vendedor/);
    expect(roles.context).toMatch(/caseta/i);
    expect(roles.context).not.toBe(roles.agent);
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
