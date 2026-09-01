import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetAndMigrateAll } from "@/tests/helpers/db";
import { DAILY_BILLED_SESSIONS_PER_USER, GLOBAL_MAX_CONCURRENT_CONVAI, GLOBAL_MONTHLY_CONVAI_MAX_SECONDS } from "@/lib/voice/brakes";
import {
  checkDailyUserBudget,
  checkGlobalMonthlyBudget,
  checkConcurrentConvaiSlots,
  getOrCreateVerifiedUser,
  reserveBilledSession,
  acquireConvaiSlot,
  releaseConvaiSlot,
  recordConvaiSeconds,
  checkSessionConvaiBudget,
  getSessionUsage,
} from "@/lib/voice/usage";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("KLM-45 voice usage (integration)", () => {
  let client: Client;

  beforeAll(async () => {
    client = new Client({ connectionString: databaseUrl });
    await client.connect();
    await resetAndMigrateAll(client);
  });

  afterAll(async () => {
    await client.end();
  });

  it("allows one billed session per user per UTC day", async () => {
    const userId = await getOrCreateVerifiedUser(client, "test@example.com");
    const first = await reserveBilledSession(client, userId);
    expect("sessionUsageId" in first).toBe(true);

    const daily = await checkDailyUserBudget(client, userId);
    expect(daily.allowed).toBe(false);
    expect(daily.reason).toBe("daily_session_limit");
  });

  it("enforces global concurrent ConvAI slot limit", async () => {
    const userA = await getOrCreateVerifiedUser(client, "a@example.com");
    const userB = await getOrCreateVerifiedUser(client, "b@example.com");

    const s1 = await reserveBilledSession(client, userA);
    const s2 = await reserveBilledSession(client, userB);
    expect("sessionUsageId" in s1 && "sessionUsageId" in s2).toBe(true);

    if (!("sessionUsageId" in s1) || !("sessionUsageId" in s2)) return;

    await acquireConvaiSlot(client, s1.sessionUsageId);
    await acquireConvaiSlot(client, s2.sessionUsageId);

    const slots = await checkConcurrentConvaiSlots(client);
    expect(slots.allowed).toBe(false);

    await releaseConvaiSlot(client, s1.sessionUsageId);
    const slotsAfter = await checkConcurrentConvaiSlots(client);
    expect(slotsAfter.allowed).toBe(true);

    expect(GLOBAL_MAX_CONCURRENT_CONVAI).toBe(2);
    expect(DAILY_BILLED_SESSIONS_PER_USER).toBe(1);
  });

  it("enforces session ConvAI 180s hard stop", async () => {
    const userId = await getOrCreateVerifiedUser(client, "convai@example.com");
    const session = await reserveBilledSession(client, userId);
    if (!("sessionUsageId" in session)) return;

    await recordConvaiSeconds(client, session.sessionUsageId, 180);
    const usage = await getSessionUsage(client, session.sessionUsageId);
    expect(usage).not.toBeNull();
    const check = await checkSessionConvaiBudget(usage!);
    expect(check.allowed).toBe(false);
  });

  it("tracks global monthly ConvAI seconds", async () => {
    const monthly = await checkGlobalMonthlyBudget(client);
    expect(monthly.allowed).toBe(true);

    const { year, month } = {
      year: new Date().getUTCFullYear(),
      month: new Date().getUTCMonth() + 1,
    };
    await client.query(
      `INSERT INTO voice_global_monthly_usage (usage_year, usage_month, convai_seconds_used)
       VALUES ($1, $2, $3)
       ON CONFLICT (usage_year, usage_month)
       DO UPDATE SET convai_seconds_used = $3`,
      [year, month, GLOBAL_MONTHLY_CONVAI_MAX_SECONDS],
    );

    const exhausted = await checkGlobalMonthlyBudget(client);
    expect(exhausted.allowed).toBe(false);
    expect(exhausted.reason).toBe("global_monthly_limit");
  });
});
