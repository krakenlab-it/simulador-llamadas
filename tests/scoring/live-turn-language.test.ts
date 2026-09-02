import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scoreLiveTurn } from "@/lib/scoring/live-turn";
import { generateGroqClientReply } from "@/lib/llm/client-replies";
import { resolveTtsLanguageCode } from "@/lib/scenarios/language";
import { buildPresetScenarioConfig } from "@/lib/scenarios/preset-config";

vi.mock("@/lib/llm/client-replies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/llm/client-replies")>();
  return {
    ...actual,
    isGroqAvailable: vi.fn(() => true),
    generateGroqClientReply: vi.fn(async (input, fallback) => {
      const prompt = actual.buildClientReplyPrompt(input);
      if (!/español/i.test(prompt)) {
        throw new Error(`last-phase prompt lost Spanish lock: ${prompt}`);
      }
      return fallback;
    }),
  };
});

describe("live-turn language lock — last clinic phase", () => {
  const savedGroq = process.env.GROQ_API_KEY;

  beforeEach(() => {
    process.env.GROQ_API_KEY = "gsk-test";
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (savedGroq === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = savedGroq;
    }
  });

  it("still requests Spanish on cierre overflow turn 10", async () => {
    const preset = buildPresetScenarioConfig("rodrigo");
    expect(resolveTtsLanguageCode(preset)).toBe("es");

    const result = await scoreLiveTurn({
      utterance: "Let's close this with a follow-up next Tuesday at 10.",
      roundKey: "cierre-10",
      roundType: "cierre",
      roundLabel: "Cierre",
      roundGoal: "Día y hora",
      difficultyLevel: 3,
      scenarioSlug: "rodrigo",
      isPreset: true,
      config: preset,
      clientName: "Rodrigo",
      isLastRound: false,
      roundNumber: 10,
      priorLines: [],
    });

    expect(generateGroqClientReply).toHaveBeenCalledTimes(1);
    const groqInput = vi.mocked(generateGroqClientReply).mock.calls[0]![0];
    expect(groqInput.round.key).toBe("cierre");
    expect(groqInput.roundNumber).toBe(10);
    expect(resolveTtsLanguageCode(groqInput.config)).toBe("es");
    expect(result.clientReply.length).toBeGreaterThan(0);
  });
});
