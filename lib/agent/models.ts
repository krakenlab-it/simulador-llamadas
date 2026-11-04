/** DeepSeek served through Vercel AI Gateway (happy path). */
export const DEFAULT_GATEWAY_DEEPSEEK_MODEL = "deepseek/deepseek-v4-flash";
/** Last-resort direct DeepSeek SDK slug — not the default path. */
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
/**
 * KAN-144: single source of truth for direct-provider model ids.
 * Groq shut down `llama-3.1-8b-instant` on 2026-08-16 (replacement `openai/gpt-oss-20b`):
 * https://console.groq.com/docs/deprecations
 * Google shut down `gemini-2.0-flash` on 2026-06-01; `gemini-3.5-flash-lite` is the
 * current low-cost Flash-Lite tier: https://ai.google.dev/gemini-api/docs/deprecations
 */
export const FALLBACK_GROQ_MODEL = "openai/gpt-oss-20b";
/** gpt-oss is a reasoning model on Groq; keep reasoning cheap so short replies still get content. */
export const GROQ_REASONING_EFFORT = "low";
export const FALLBACK_GEMINI_MODEL = "gemini-3.5-flash-lite";
/**
 * STT uses multimodal `generateContent`, which `gemini-3.5-flash-lite` supports (audio input).
 * `gemini-3.5-transcribe` needs the Interactions API, so it is a separate follow-up.
 */
export const GEMINI_TRANSCRIBE_MODEL = FALLBACK_GEMINI_MODEL;

/** Model ids providers have shut down; must never appear in source again. */
export const SHUT_DOWN_MODEL_IDS = ["llama-3.1-8b-instant", "gemini-2.0-flash"] as const;
