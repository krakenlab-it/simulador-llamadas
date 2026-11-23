import "@testing-library/jest-dom/vitest";

if (typeof HTMLMediaElement !== "undefined") {
  HTMLMediaElement.prototype.play = () => Promise.resolve();
  HTMLMediaElement.prototype.pause = () => undefined;
}

if (typeof URL !== "undefined" && typeof URL.createObjectURL !== "function") {
  URL.createObjectURL = () => "blob:test";
  URL.revokeObjectURL = () => undefined;
}

// KAN-176: unit tests must not depend on whichever LLM keys the shell happens
// to export. A developer box with AI_GATEWAY_API_KEY (or DEEPSEEK_API_KEY) set
// sends preset turns down the DeepSeek path, so Groq-path tests fail and some
// tests make real, billed API calls. Tests that need a key set it themselves.
// Opt out with SIM_LIVE_LLM_TESTS=1 for deliberate live runs.
if (process.env.SIM_LIVE_LLM_TESTS !== "1") {
  for (const name of [
    "AI_GATEWAY_API_KEY",
    "VERCEL_OIDC_TOKEN",
    "DEEPSEEK_API_KEY",
    "GROQ_API_KEY",
    "GOOGLE_API_KEY",
    "ELEVENLABS_API_KEY",
  ]) {
    delete process.env[name];
  }
}
