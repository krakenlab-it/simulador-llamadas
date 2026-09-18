import { describe, expect, it } from "vitest";
import { composeSeparatedSystemPrompt } from "@/lib/agent/roles";
import { resolveHarnessState } from "@/lib/agent/states";
import { emptyAuthoringDraft } from "@/lib/scenarios/authoring";

describe("harness roles and states", () => {
  it("keeps agent, user and context in separate labeled channels", () => {
    const prompt = composeSeparatedSystemPrompt({
      agent: "Diseñas el caso.",
      user: "El usuario es el vendedor.",
      context: "Catálogo: Mariana",
    });
    expect(prompt).toContain("=== CANAL AGENTE ===");
    expect(prompt).toContain("=== CANAL USUARIO ===");
    expect(prompt).toContain("=== CANAL CONTEXTO ===");
    expect(prompt.indexOf("CANAL AGENTE")).toBeLessThan(
      prompt.indexOf("CANAL CONTEXTO"),
    );
    expect(prompt).toContain("Catálogo: Mariana");
    expect(prompt).not.toMatch(/Catálogo: Mariana[\s\S]*Diseñas el caso/);
  });

  it("walks idle → gathering → proposing → ready → comparing", () => {
    expect(
      resolveHarnessState({
        draft: null,
        applied: false,
        comparing: false,
        messageCount: 0,
      }),
    ).toBe("idle");
    expect(
      resolveHarnessState({
        draft: null,
        applied: false,
        comparing: false,
        messageCount: 1,
      }),
    ).toBe("gathering");
    expect(
      resolveHarnessState({
        draft: emptyAuthoringDraft("es"),
        applied: false,
        comparing: false,
        messageCount: 1,
      }),
    ).toBe("proposing");
    expect(
      resolveHarnessState({
        draft: emptyAuthoringDraft("es"),
        applied: true,
        comparing: false,
        messageCount: 2,
      }),
    ).toBe("ready");
    expect(
      resolveHarnessState({
        draft: null,
        applied: false,
        comparing: true,
        messageCount: 2,
      }),
    ).toBe("comparing");
  });
});
