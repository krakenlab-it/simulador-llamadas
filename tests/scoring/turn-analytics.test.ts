import { describe, expect, it } from "vitest";
import {
  computeTurnAnalytics,
  computeTurnExchangeTalkPercent,
} from "@/lib/scoring/analytics";

describe("per-turn talk analytics", () => {
  it("does not report 100% when only the trainee turn exists without client context", () => {
    const percent = computeTurnExchangeTalkPercent(
      "Buenos días, le llamo por las visitas a caseta que no están convirtiendo en su tienda.",
      [],
    );

    expect(percent).toBeLessThan(100);
  });

  it("balances against the last client line in the exchange", () => {
    const percent = computeTurnExchangeTalkPercent(
      "Le propongo revisar juntos el tráfico a piso el martes a las diez.",
      [{ role: "client", text: "¿Quién habla? Estoy entre juntas." }],
    );

    expect(percent).toBeGreaterThan(40);
    expect(percent).toBeLessThan(95);
  });

  it("prepends opening context via computeTurnAnalytics enrichment path in live turn", () => {
    const analytics = computeTurnAnalytics({
      utterance: "Le llamo por la caseta y las visitas que no convierten.",
      priorLines: [{ role: "client", text: "Mariana Escobedo. Dígame rápido qué quiere." }],
    });

    expect(analytics.talkPercent).toBeLessThan(100);
  });
});
