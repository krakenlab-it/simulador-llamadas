import { describe, expect, it } from "vitest";
import { htmlLangForVoice } from "@/lib/a11y/document-lang";
import { nextRovingValue } from "@/lib/a11y/roving-options";

describe("document language", () => {
  it("maps voice language to html lang for es and en", () => {
    expect(htmlLangForVoice("es")).toBe("es");
    expect(htmlLangForVoice("en")).toBe("en");
  });
});

describe("roving options", () => {
  it("moves with arrows and jumps to ends", () => {
    const options = ["library", "custom"] as const;
    expect(nextRovingValue(options, "library", "ArrowRight")).toBe("custom");
    expect(nextRovingValue(options, "custom", "ArrowRight")).toBe("library");
    expect(nextRovingValue(options, "custom", "Home")).toBe("library");
    expect(nextRovingValue(options, "library", "End")).toBe("custom");
    expect(nextRovingValue(options, "library", "Enter")).toBeNull();
  });
});
