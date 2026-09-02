import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerateReplyInput } from "@/lib/llm/client-replies";
import {
  GROQ_CLIENT_REPLY_TIMEOUT_MS,
  buildClientReplyPrompt,
  generateGroqClientReply,
  isGroqAvailable,
} from "@/lib/llm/client-replies";

const baseInput: GenerateReplyInput = {
  config: {
    industry: "Farmacias",
    productSold: "Software",
    clientProblem: "Baja conversión",
    objections: [],
    winCriteria: "Reunión",
    temperament: "exigente",
    rounds: [],
    criteria: [],
    globalPositiveCriteria: [],
    openingLines: [],
  },
  round: {
    key: "apertura",
    label: "Apertura",
    goal: "Enganchar",
    clientPrompt: "¿Quién habla?",
    positiveCriteria: [],
    negativeCriteria: [],
  },
  reaction: "medio",
  clientName: "Rodrigo",
  traineeUtterance: "Buenos días, le llamo de Kraken Lab.",
  roundNumber: 0,
};

describe("isGroqAvailable", () => {
  const saved = process.env.GROQ_API_KEY;

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = saved;
    }
  });

  it("is true only when GROQ_API_KEY is set", () => {
    delete process.env.GROQ_API_KEY;
    expect(isGroqAvailable()).toBe(false);

    process.env.GROQ_API_KEY = "gsk-test";
    expect(isGroqAvailable()).toBe(true);
  });
});

describe("generateGroqClientReply", () => {
  const savedGroq = process.env.GROQ_API_KEY;
  const savedGoogle = process.env.GOOGLE_API_KEY;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (savedGroq === undefined) {
      delete process.env.GROQ_API_KEY;
    } else {
      process.env.GROQ_API_KEY = savedGroq;
    }
    if (savedGoogle === undefined) {
      delete process.env.GOOGLE_API_KEY;
    } else {
      process.env.GOOGLE_API_KEY = savedGoogle;
    }
  });

  it("returns scripted fallback when Groq is not configured", async () => {
    delete process.env.GROQ_API_KEY;
    process.env.GOOGLE_API_KEY = "google-only";

    const reply = await generateGroqClientReply(baseInput, "Réplica guionizada.");

    expect(reply).toBe("Réplica guionizada.");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("returns Groq text on success", async () => {
    process.env.GROQ_API_KEY = "gsk-test";
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Entiendo, cuénteme más del problema." } }],
        }),
        { status: 200 },
      ),
    );

    const reply = await generateGroqClientReply(baseInput, "Réplica guionizada.");

    expect(reply).toBe("Entiendo, cuénteme más del problema.");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("returns scripted fallback when Groq times out", async () => {
    process.env.GROQ_API_KEY = "gsk-test";
    vi.useFakeTimers();

    vi.mocked(fetch).mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );

    const replyPromise = generateGroqClientReply(baseInput, "Réplica guionizada.");
    await vi.advanceTimersByTimeAsync(GROQ_CLIENT_REPLY_TIMEOUT_MS + 50);
    const reply = await replyPromise;

    expect(reply).toBe("Réplica guionizada.");
    vi.useRealTimers();
  });

  it("locks Spanish on the last cierre overflow turn even if the seller used English", async () => {
    process.env.GROQ_API_KEY = "gsk-test";
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "Sin día y hora concretos no hay reunión." } }],
        }),
        { status: 200 },
      ),
    );

    const lastPhase: GenerateReplyInput = {
      ...baseInput,
      config: { ...baseInput.config, language: "es" },
      round: {
        key: "cierre",
        label: "Cierre",
        goal: "Día y hora",
        clientPrompt: "Si no hay fecha, no hay reunión.",
        positiveCriteria: [],
        negativeCriteria: [],
      },
      roundNumber: 10,
      traineeUtterance: "Let's schedule a follow-up meeting next Tuesday at 10.",
    };

    const prompt = buildClientReplyPrompt(lastPhase);
    expect(prompt.toLowerCase()).toMatch(/español/);
    expect(prompt).not.toMatch(/mismo idioma que el vendedor/i);

    await generateGroqClientReply(lastPhase, "Sin día y hora no hay reunión.");

    const init = vi.mocked(fetch).mock.calls[0]?.[1];
    const body = JSON.parse(String(init?.body)) as {
      messages: { role: string; content: string }[];
    };
    const sent = body.messages.map((m) => m.content).join("\n");
    expect(sent.toLowerCase()).toMatch(/español/);
    expect(sent).not.toMatch(/mismo idioma que el vendedor/i);
    expect(body.messages.some((m) => m.role === "system")).toBe(true);
  });
});
