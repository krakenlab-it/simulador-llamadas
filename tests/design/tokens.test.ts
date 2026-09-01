import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS_PATH = resolve(process.cwd(), "styles/tokens.css");

const LOCKED_TOKENS = [
  "--bg: #0b0f14",
  "--surface: #141a22",
  "--paper: #f4efe6",
  "--ink: #0b0f14",
  "--accent: #e8f07a",
  "--accent-2: #c45c26",
  "--muted: #8b93a1",
  "--line: rgba(244, 239, 230, 0.12)",
  "--radius-control: 14px",
  "--radius-card: 22px",
  "--radius-pill: 999px",
] as const;

describe("design tokens", () => {
  it("documents locked tokens in styles/tokens.css for other PRs", () => {
    const css = readFileSync(TOKENS_PATH, "utf8");

    for (const token of LOCKED_TOKENS) {
      expect(css).toContain(token);
    }

    expect(css).toContain("--ease-out: cubic-bezier(0.22, 1, 0.36, 1)");
    expect(css).toContain("--font-display");
    expect(css).toContain("--font-mono");
  });
});
