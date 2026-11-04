import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_GEMINI_MODEL, FALLBACK_GROQ_MODEL } from "@/lib/agent/models";
import { buildScenarioConfig } from "@/lib/scenarios/defaults";
import { scoreCall } from "@/lib/scoring/score-call";
import { GOOD_DISCOVERY_TRANSCRIPT } from "../fixtures/scoring/transcripts";

// KAN-144: the post-call scorecard must hit the configured (live) model id and use the
// LLM result, and a provider failure must be logged instead of failing silently.

const LLM_PAYLOAD = {
  dimensions: [
    { id: "apertura_contrato", score: 4, rationale: "Presentación clara" },
    { id: "discovery_escucha", score: 5, rationale: "Preguntas abiertas" },
    { id: "dolor_implicacion", score: 4, rationale: "Explora impacto" },
    { id: "valor_tailor", score: 3, rationale: "Valor adaptado" },
    { id: "compostura_objecion", score: 3, rationale: "Sin objeción", notApplicable: true },
    { id: "cierre_siguiente_paso", score: 2, rationale: "Cierre vago" },
  ],
  strengthDimension: "discovery_escucha",
  gapDimension: "cierre_siguiente_paso",
  strengthQuote: "LLM-STRENGTH-QUOTE",
  gapQuote: "LLM-GAP-QUOTE",
  betterLines: { variantA: "Variante A", variantB: "Variante B" },
  drill: "LLM-DRILL: propone fecha y hora concreta",
};

const config = buildScenarioConfig({
  industry: GOOD_DISCOVERY_TRANSCRIPT.industry,
  productSold: GOOD_DISCOVERY_TRANSCRIPT.productSold,
  clientProblem: GOOD_DISCOVERY_TRANSCRIPT.clientProblem,
  objections: ["No tengo tiempo"],
  winCriteria: "SPIN Advance: siguiente acción concreta acordada o propuesta",
  temperament: "Escéptico",
  clientName: "Cliente",
});

const saved = { groq: process.env.GROQ_API_KEY, google: process.env.GOOGLE_API_KEY };

function restore(name: "GROQ_API_KEY" | "GOOGLE_API_KEY", value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

describe("post-call scorecard model config (KAN-144)", () => {
  beforeEach(() => {
    delete process.env.GROQ_API_KEY;
    delete process.env.GOOGLE_API_KEY;
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    restore("GROQ_API_KEY", saved.groq);
    restore("GOOGLE_API_KEY", saved.google);
  });

  it("calls Groq with the configured model id and returns the LLM scorecard", async () => {
    process.env.GROQ_API_KEY = "synthetic-test-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: JSON.stringify(LLM_PAYLOAD) } }] }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await scoreCall({
      lines: GOOD_DISCOVERY_TRANSCRIPT.lines,
      config,
      isPreset: false,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("api.groq.com");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe(FALLBACK_GROQ_MODEL);
    expect(body.model).toBe("openai/gpt-oss-20b");
    expect(body.reasoning_effort).toBe("low");
    expect(JSON.stringify(result)).toContain("LLM-DRILL");
  });

  it("calls Gemini with the configured model id when only GOOGLE_API_KEY is set", async () => {
    process.env.GOOGLE_API_KEY = "synthetic-test-key";
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: JSON.stringify(LLM_PAYLOAD) }] } }],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await scoreCall({ lines: GOOD_DISCOVERY_TRANSCRIPT.lines, config, isPreset: false });

    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain(`/models/${FALLBACK_GEMINI_MODEL}:generateContent`);
    expect(FALLBACK_GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
    expect(JSON.stringify(result)).toContain("LLM-DRILL");
  });

  it("warns (no secrets) instead of silently falling back when the provider rejects the model", async () => {
    process.env.GROQ_API_KEY = "synthetic-test-key";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("model_decommissioned", { status: 400 })));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await scoreCall({ lines: GOOD_DISCOVERY_TRANSCRIPT.lines, config, isPreset: false });

    expect(JSON.stringify(result)).not.toContain("LLM-DRILL");
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0][0]);
    expect(message).toContain(FALLBACK_GROQ_MODEL);
    expect(message).toContain("400");
    expect(message).not.toContain("synthetic-test-key");
  });
});
