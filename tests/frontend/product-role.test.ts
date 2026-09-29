import { describe, expect, it, beforeEach } from "vitest";
import {
  clearProductRole,
  readProductRole,
  writeProductRole,
} from "@/lib/frontend/product-role";

describe("product role persistence", () => {
  beforeEach(() => {
    clearProductRole();
  });

  it("round-trips capacitador and agente", () => {
    expect(readProductRole()).toBeNull();
    writeProductRole("capacitador");
    expect(readProductRole()).toBe("capacitador");
    writeProductRole("agente");
    expect(readProductRole()).toBe("agente");
    clearProductRole();
    expect(readProductRole()).toBeNull();
  });
});
