import { describe, expect, it } from "vitest";
import { isAutosubmitReady } from "@/lib/voice/autosubmit";

describe("voice autosubmit guard", () => {
  it("requires at least three words before autosubmit", () => {
    expect(isAutosubmitReady("Hola")).toBe(false);
    expect(isAutosubmitReady("somos gente")).toBe(false);
    expect(isAutosubmitReady("somos gente real")).toBe(true);
    expect(isAutosubmitReady("  hola   mariana   kraken  ")).toBe(true);
  });
});
