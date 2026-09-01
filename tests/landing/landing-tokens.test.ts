import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LANDING_CSS = resolve(
  process.cwd(),
  "app/components/landing/landing.module.css",
);
const DESIGN_TOKENS = resolve(process.cwd(), "app/design-tokens.css");

const LOCKED_PALETTE_VARS = [
  "var(--bg)",
  "var(--accent)",
  "var(--accent-2)",
  "var(--text)", // semantic alias for --paper on dark surfaces
] as const;

const LANDING_TOKEN_ALIASES = [
  "--ease-out:",
  "--radius-control:",
  "--radius-pill:",
  "--radius-card:",
  "--transition:",
  "--shadow-soft:",
] as const;

const CDC_COLORS = ["#ff5a1f", "#00a08a", "#0e1a2b", "#6d5cff", "#ff5e62"];

describe("landing page design tokens", () => {
  it("styles the landing with locked palette vars, not CDC hex values", () => {
    const css = readFileSync(LANDING_CSS, "utf8");

    for (const tokenRef of LOCKED_PALETTE_VARS) {
      expect(css).toContain(tokenRef);
    }

    for (const legacy of CDC_COLORS) {
      expect(css.toLowerCase()).not.toContain(legacy);
    }
  });

  it("defines landing token aliases in the imported design-tokens file", () => {
    const css = readFileSync(DESIGN_TOKENS, "utf8");

    for (const alias of LANDING_TOKEN_ALIASES) {
      expect(css).toContain(alias);
    }
  });

  it("keeps reveal content visible when animation shorthand would be invalid", () => {
    const css = readFileSync(LANDING_CSS, "utf8");
    const revealBlock = css.slice(css.indexOf(".reveal {"), css.indexOf(".revealDelay1"));

    expect(revealBlock).toContain("var(--ease-out, var(--ease))");
    expect(revealBlock).not.toContain("opacity: 0");
  });
});
