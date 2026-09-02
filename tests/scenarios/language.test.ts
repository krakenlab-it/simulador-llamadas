import { describe, expect, it } from "vitest";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import {
  resolveScenarioLanguage,
  resolveTtsLanguageCode,
  resolveSpeechLocale,
} from "@/lib/scenarios/language";

describe("scenario language lock", () => {
  it("resolves clinic presets to Spanish / es / es-MX", () => {
    const config = buildPresetScenarioConfig("mariana");
    expect(config).not.toBeNull();
    const language = resolveScenarioLanguage(config);
    expect(language.iso639).toBe("es");
    expect(language.locale).toBe("es-MX");
    expect(language.promptName.toLowerCase()).toContain("español");
    expect(resolveTtsLanguageCode(config)).toBe("es");
    expect(resolveSpeechLocale(config)).toBe("es-MX");
  });

  it("keeps Spanish on a custom scenario that does not declare another language", () => {
    const config = buildScenarioConfig({
      industry: "clínica dental",
      productSold: "plan de retención",
      clientProblem: "citas que no confirman",
      objections: ["Ya tengo software"],
      winCriteria: "Reunión con día y hora",
      temperament: "Directo",
      clientName: "Lucía",
    });
    expect(resolveTtsLanguageCode(config)).toBe("es");
    expect(resolveSpeechLocale(config)).toBe("es-MX");
  });

  it("honors an explicit non-Spanish scenario language", () => {
    const language = resolveScenarioLanguage({ language: "en" });
    expect(language.iso639).toBe("en");
    expect(language.locale).toBe("en-US");
    expect(resolveTtsLanguageCode({ language: "en" })).toBe("en");
  });
});
