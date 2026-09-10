import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("scenario card selected styles", () => {
  it("uses vivid yellow selection outside kraken-wizard scope", () => {
    const css = readFileSync(join(process.cwd(), "app/globals.css"), "utf8");

    expect(css).toContain(".card.card--interactive.card--selected,");
    expect(css).toContain(
      ".scenario-card-wrap .card.card--interactive.card--selected {",
    );
    expect(css).toContain("border-color: #e8f07a;");
    expect(css).toContain(
      ".scenario-card-wrap .card.card--interactive.card--selected .scenario-card__name {",
    );
    expect(css).toContain("color: #e8f07a;");
  });
});
