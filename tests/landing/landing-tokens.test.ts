import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LANDING_CSS = resolve(
  process.cwd(),
  "app/components/landing/landing.module.css",
);

const LOCKED_PALETTE_VARS = [
  "var(--bg)",
  "var(--accent)",
  "var(--accent-2)",
  "var(--text)", // semantic alias for --paper on dark surfaces
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
});
