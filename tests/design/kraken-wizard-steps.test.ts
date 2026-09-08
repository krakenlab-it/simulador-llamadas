import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("Kraken wizard step pill styles", () => {
  it("uses explicit high-contrast hex colors with scoped selectors", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toContain(".kraken-wizard .wizard-steps .wizard-steps__item {");
    expect(css).toContain(".kraken-wizard .wizard-steps .wizard-steps__item--active {");
    expect(css).toContain(".kraken-wizard .wizard-steps .wizard-steps__item--done {");
    expect(css).toContain("background: #1a222c;");
    expect(css).toContain("color: #e8edf5;");
    expect(css).toContain("border: 1px solid #3a4553;");
    expect(css).toContain("background: #e8f07a;");
    expect(css).toContain("color: #0b0f14;");
    expect(css).not.toContain("color-mix(in srgb, var(--paper) 92%");
  });
});
