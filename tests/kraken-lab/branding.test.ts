import { describe, expect, it } from "vitest";
import {
  KRAKEN_SIMULACION_PRODUCT_NAME,
  NUEVA_SIMULACION_CTA_LABEL,
  WIZARD_STEP_LABELS,
} from "@/lib/kraken-lab/constants";
import { landingContent } from "@/lib/landing/content";

describe("Kraken Simulación user-facing branding", () => {
  it("uses Kraken Simulación as the product line name", () => {
    expect(KRAKEN_SIMULACION_PRODUCT_NAME).toBe("Kraken Simulación");
    expect(NUEVA_SIMULACION_CTA_LABEL).toBe("Nueva simulación · Kraken Simulación");
    expect(WIZARD_STEP_LABELS.proyecto).toBe("Proyecto Kraken Simulación");
    expect(WIZARD_STEP_LABELS.perfiles).toBe("Perfiles de participantes");
    expect(landingContent.footer).toBe("Demo interna · Kraken Simulación");
  });

  it("does not expose legacy Pasantes or Kraken Lab product titles", () => {
    const corpus = [
      KRAKEN_SIMULACION_PRODUCT_NAME,
      NUEVA_SIMULACION_CTA_LABEL,
      landingContent.footer,
      ...Object.values(WIZARD_STEP_LABELS),
    ].join(" ");

    expect(corpus.toLowerCase()).not.toContain("pasantes");
    expect(corpus).not.toContain("Kraken Lab ·");
    expect(corpus).not.toContain("Simulación escenarios");
  });
});
