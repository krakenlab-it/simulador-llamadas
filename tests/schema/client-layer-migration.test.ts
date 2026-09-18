import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20260918200000_kan91_client_layer.sql",
);

describe("KAN-91 client layer migration (static)", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("adds session_config and client_layer_state on call_attempts", () => {
    expect(sql).toMatch(/ALTER TABLE call_attempts/i);
    expect(sql).toContain("session_config");
    expect(sql).toContain("client_layer_state");
    expect(sql).toMatch(/JSONB/i);
  });

  it("does not drop calls or rewrite the clinic seed", () => {
    expect(sql).not.toMatch(/DROP TABLE/i);
    expect(sql).not.toMatch(/INSERT INTO scenarios/i);
    expect(sql).not.toContain("voice_convai_agents");
  });
});
