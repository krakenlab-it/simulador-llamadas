import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const MIGRATION = join(
  process.cwd(),
  "supabase/migrations/20250831000004_voice_usage_brakes.sql",
);

describe("voice brakes migration (static)", () => {
  const sql = readFileSync(MIGRATION, "utf-8");

  it("creates voice_verified_users for authenticated voice billing", () => {
    expect(sql).toContain("CREATE TABLE voice_verified_users");
    expect(sql).toContain("email TEXT NOT NULL UNIQUE");
  });

  it("creates per-session usage counters", () => {
    expect(sql).toContain("CREATE TABLE voice_session_usage");
    expect(sql).toContain("convai_seconds_used");
    expect(sql).toContain("trainee_audio_seconds_used");
    expect(sql).toContain("extra_tts_chars_used");
  });

  it("creates daily per-user billed session counter", () => {
    expect(sql).toContain("CREATE TABLE voice_daily_user_usage");
    expect(sql).toContain("billed_sessions_used");
  });

  it("creates global monthly ConvAI seconds counter", () => {
    expect(sql).toContain("CREATE TABLE voice_global_monthly_usage");
    expect(sql).toContain("convai_seconds_used");
  });
});
