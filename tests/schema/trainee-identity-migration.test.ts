import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20250902000000_trainee_identity.sql",
);

describe("trainee identity migration (static)", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("adds a unique lower(email) index for durable trainee lookup", () => {
    expect(sql).toContain("trainees_email_lower_uidx");
    expect(sql).toMatch(/lower\(email\)/i);
    expect(sql).toMatch(/WHERE email IS NOT NULL/i);
  });
});
