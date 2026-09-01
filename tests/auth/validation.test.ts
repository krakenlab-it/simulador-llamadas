import { describe, expect, it } from "vitest";
import { validateSignUp } from "@/lib/auth/validation";

describe("auth validation", () => {
  it("rejects signup when passwords do not match", () => {
    const error = validateSignUp({
      email: "demo@cdc.mx",
      password: "secreto1",
      confirmPassword: "secreto2",
    });

    expect(error).toBe("Las contraseñas no coinciden.");
  });

  it("accepts signup when passwords match", () => {
    const error = validateSignUp({
      email: "demo@cdc.mx",
      password: "secreto1",
      confirmPassword: "secreto1",
    });

    expect(error).toBeNull();
  });
});
