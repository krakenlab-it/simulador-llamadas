import { afterEach, describe, expect, it, vi } from "vitest";
import { scoreTurnAdaptive } from "@/lib/scoring/adaptive";

vi.mock("@/lib/llm/client-replies", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/llm/client-replies")>();
  return {
    ...actual,
    isGroqAvailable: vi.fn(() => true),
    generateGroqClientReply: vi.fn(async (_input, fallback) => fallback),
  };
});

import {
  generateGroqClientReply,
  isGroqAvailable,
} from "@/lib/llm/client-replies";

describe("scoreTurnAdaptive — clinic preset Groq gate", () => {
  const savedGroq = process.env.GROQ_API_KEY;

  afterEach(() => {
    vi.clearAllMocks();
    if (savedGroq === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = savedGroq;
    }
  });

  it("uses generateGroqClientReply for clinic presets when Groq is available", async () => {
    process.env.GROQ_API_KEY = "gsk-test";

    const result = await scoreTurnAdaptive({
      utterance: "Buenos días, le llamo porque vimos que su farmacia pierde visitas.",
      roundKey: "apertura",
      roundLabel: "Apertura",
      roundGoal: "Enganchar",
      difficultyLevel: 2,
      scenarioSlug: "rodrigo",
      isPreset: true,
      config: null,
      clientName: "Rodrigo",
      isLastRound: false,
    });

    expect(isGroqAvailable).toHaveBeenCalled();
    expect(generateGroqClientReply).toHaveBeenCalled();
    expect(result.clientReply).toBeTruthy();
  });

  it("skips Groq when GROQ_API_KEY is unset", async () => {
    vi.mocked(isGroqAvailable).mockReturnValue(false);
    delete process.env.GROQ_API_KEY;

    const result = await scoreTurnAdaptive({
      utterance: "Buenos días, le llamo porque vimos que su farmacia pierde visitas.",
      roundKey: "apertura",
      roundLabel: "Apertura",
      roundGoal: "Enganchar",
      difficultyLevel: 2,
      scenarioSlug: "rodrigo",
      isPreset: true,
      config: null,
      clientName: "Rodrigo",
      isLastRound: false,
    });

    expect(generateGroqClientReply).not.toHaveBeenCalled();
    expect(result.clientReply).toBeTruthy();
  });
});
