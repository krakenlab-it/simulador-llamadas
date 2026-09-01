import { describe, expect, it } from "vitest";
import { resolvePostAuthTarget } from "@/lib/auth/validation";

describe("post-auth redirect", () => {
  it("redirects to dashboard after successful authentication", () => {
    expect(resolvePostAuthTarget(true, "dashboard")).toBe("dashboard");
  });

  it("does not redirect when authentication failed", () => {
    expect(resolvePostAuthTarget(false, "dashboard")).toBeNull();
  });

  it("can target voice verification after inline login", () => {
    expect(resolvePostAuthTarget(true, "voice")).toBe("voice");
  });
});
