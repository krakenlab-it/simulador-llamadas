import { describe, expect, it } from "vitest";
import { checkReplyGrounding } from "@/lib/agentic/grounding";
import type { ScenarioPack } from "@/lib/agentic/types";

describe("checkReplyGrounding", () => {
  const pack: ScenarioPack = {
    facts: ["El presupuesto anual es de 50 mil pesos"],
    objections: ["Caro"],
    product: "Membresía premium",
    winCriteria: "Visita al gimnasio",
    forbiddenClaims: ["100% de éxito"],
    snippets: [{ id: "s1", text: "El presupuesto anual es de 50 mil pesos" }],
    contextText: "El presupuesto anual es de 50 mil pesos",
  };

  it("rejects a reply with a fabricated price not in the pack", () => {
    const result = checkReplyGrounding(
      "Puedo ofrecerle un plan por $999 USD hoy mismo.",
      pack,
      "Ana López",
    );
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("invented_number");
  });

  it("accepts a reply without invented numbers", () => {
    const result = checkReplyGrounding(
      "Entiendo, el presupuesto es ajustado este trimestre.",
      pack,
      "Ana López",
    );
    expect(result.ok).toBe(true);
  });
});
