import { describe, expect, it } from "vitest";
import {
  DEFAULT_KRAKEN_WIZARD_MODE,
  resolveKrakenWizardPracticeMode,
} from "@/lib/kraken-lab/wizard-draft-storage";

describe("Kraken wizard practice mode defaults", () => {
  it("defaults new drafts to voz when no stored mode exists", () => {
    expect(DEFAULT_KRAKEN_WIZARD_MODE).toBe("voz");
    expect(resolveKrakenWizardPracticeMode(undefined)).toBe("voz");
  });

  it("restores a previously saved texto mode from storage", () => {
    expect(resolveKrakenWizardPracticeMode("texto")).toBe("texto");
    expect(resolveKrakenWizardPracticeMode("voz")).toBe("voz");
  });
});
