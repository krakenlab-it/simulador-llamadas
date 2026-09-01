import { describe, expect, it } from "vitest";
import { getRoundTypeForNumber } from "@/lib/extension-points/session";

describe("session round mapping", () => {
  it("keeps overflow turns in the cierre phase", () => {
    expect(getRoundTypeForNumber(5)).toBe("cierre");
    expect(getRoundTypeForNumber(6)).toBe("cierre");
    expect(getRoundTypeForNumber(10)).toBe("cierre");
  });
});
