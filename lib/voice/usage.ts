import type { Client } from "pg";
import {
  DAILY_BILLED_SESSIONS_PER_USER,
  GLOBAL_MAX_CONCURRENT_CONVAI,
  GLOBAL_MONTHLY_CONVAI_MAX_SECONDS,
  MIN_CONVAI_SECONDS_TO_CONSUME_DAILY_SLOT,
  SESSION_CONVAI_MAX_SECONDS,
  SESSION_EXTRA_TTS_MAX_CHARS,
} from "@/lib/voice/brakes";

export interface VoiceSessionUsageRow {
  id: string;
  verifiedUserId: string;
  convaiSecondsUsed: number;
  traineeAudioSecondsUsed: number;
  extraTtsCharsUsed: number;
  convaiSlotHeld: boolean;
}

export interface BrakeCheckResult {
  allowed: boolean;
  reason?: string;
  fallbackToBrowser: boolean;
}

function utcDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

function utcYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export async function getOrCreateVerifiedUser(
  client: Client,
  email: string,
  authUserId?: string,
): Promise<string> {
  const normalized = email.trim().toLowerCase();
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM voice_verified_users WHERE email = $1`,
    [normalized],
  );
  if (existing.rows[0]) {
    if (authUserId) {
      await client.query(
        `UPDATE voice_verified_users SET auth_user_id = COALESCE(auth_user_id, $2) WHERE id = $1`,
        [existing.rows[0].id, authUserId],
      );
    }
    return existing.rows[0].id;
  }

  const inserted = await client.query<{ id: string }>(
    `INSERT INTO voice_verified_users (email, auth_user_id)
     VALUES ($1, $2)
     RETURNING id`,
    [normalized, authUserId ?? null],
  );
  return inserted.rows[0].id;
}

function sessionConsumedDailySlotSql(): string {
  return `(extra_tts_chars_used > 0 OR convai_seconds_used >= ${MIN_CONVAI_SECONDS_TO_CONSUME_DAILY_SLOT})`;
}

/** Sessions that actually used billed ElevenLabs audio today (not mere reserves). */
export async function countConsumedBilledSessionsToday(
  client: Client,
  verifiedUserId: string,
): Promise<number> {
  const date = utcDateString();
  const { rows } = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM voice_session_usage
     WHERE verified_user_id = $1
       AND created_at >= $2::date
       AND created_at < ($2::date + interval '1 day')
       AND ${sessionConsumedDailySlotSql()}`,
    [verifiedUserId, date],
  );
  return parseInt(rows[0]?.count ?? "0", 10);
}

async function syncDailyBilledCounter(
  client: Client,
  verifiedUserId: string,
): Promise<void> {
  const date = utcDateString();
  const consumed = await countConsumedBilledSessionsToday(client, verifiedUserId);
  await client.query(
    `INSERT INTO voice_daily_user_usage (verified_user_id, usage_date, billed_sessions_used)
     VALUES ($1, $2::date, $3)
     ON CONFLICT (verified_user_id, usage_date)
     DO UPDATE SET
       billed_sessions_used = $3,
       updated_at = now()`,
    [verifiedUserId, date, consumed],
  );
}

/** Can this user start a new billed session today? */
export async function checkDailyUserBudget(
  client: Client,
  verifiedUserId: string,
): Promise<BrakeCheckResult> {
  const consumed = await countConsumedBilledSessionsToday(client, verifiedUserId);
  if (consumed >= DAILY_BILLED_SESSIONS_PER_USER) {
    return {
      allowed: false,
      reason: "daily_session_limit",
      fallbackToBrowser: true,
    };
  }
  return { allowed: true, fallbackToBrowser: false };
}

/** Global monthly ConvAI seconds budget. */
export async function checkGlobalMonthlyBudget(
  client: Client,
): Promise<BrakeCheckResult> {
  const { year, month } = utcYearMonth();
  const { rows } = await client.query<{ convai_seconds_used: number }>(
    `SELECT convai_seconds_used FROM voice_global_monthly_usage
     WHERE usage_year = $1 AND usage_month = $2`,
    [year, month],
  );
  const used = rows[0]?.convai_seconds_used ?? 0;
  if (used >= GLOBAL_MONTHLY_CONVAI_MAX_SECONDS) {
    return {
      allowed: false,
      reason: "global_monthly_limit",
      fallbackToBrowser: true,
    };
  }
  return { allowed: true, fallbackToBrowser: false };
}

/** Global concurrent ConvAI slots (max 2). */
export async function checkConcurrentConvaiSlots(
  client: Client,
): Promise<BrakeCheckResult> {
  const { rows } = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM voice_session_usage
     WHERE convai_slot_held = true`,
  );
  const active = parseInt(rows[0]?.count ?? "0", 10);
  if (active >= GLOBAL_MAX_CONCURRENT_CONVAI) {
    return {
      allowed: false,
      reason: "concurrent_convai_limit",
      fallbackToBrowser: true,
    };
  }
  return { allowed: true, fallbackToBrowser: false };
}

export async function reserveBilledSession(
  client: Client,
  verifiedUserId: string,
  callAttemptId?: string,
): Promise<{ sessionUsageId: string } | BrakeCheckResult> {
  const daily = await checkDailyUserBudget(client, verifiedUserId);
  if (!daily.allowed) return daily;

  const monthly = await checkGlobalMonthlyBudget(client);
  if (!monthly.allowed) return monthly;

  const { rows } = await client.query<{ id: string }>(
    `INSERT INTO voice_session_usage (verified_user_id, call_attempt_id)
     VALUES ($1, $2)
     RETURNING id`,
    [verifiedUserId, callAttemptId ?? null],
  );

  return { sessionUsageId: rows[0].id };
}

export async function getSessionUsage(
  client: Client,
  sessionUsageId: string,
): Promise<VoiceSessionUsageRow | null> {
  const { rows } = await client.query<{
    id: string;
    verified_user_id: string;
    convai_seconds_used: number;
    trainee_audio_seconds_used: number;
    extra_tts_chars_used: number;
    convai_slot_held: boolean;
  }>(
    `SELECT id, verified_user_id, convai_seconds_used, trainee_audio_seconds_used,
            extra_tts_chars_used, convai_slot_held
     FROM voice_session_usage WHERE id = $1`,
    [sessionUsageId],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    verifiedUserId: row.verified_user_id,
    convaiSecondsUsed: row.convai_seconds_used,
    traineeAudioSecondsUsed: row.trainee_audio_seconds_used,
    extraTtsCharsUsed: row.extra_tts_chars_used,
    convaiSlotHeld: row.convai_slot_held,
  };
}

export async function checkSessionConvaiBudget(
  usage: VoiceSessionUsageRow,
): Promise<BrakeCheckResult> {
  if (usage.convaiSecondsUsed >= SESSION_CONVAI_MAX_SECONDS) {
    return {
      allowed: false,
      reason: "session_convai_limit",
      fallbackToBrowser: true,
    };
  }
  return { allowed: true, fallbackToBrowser: false };
}

export async function checkSessionTraineeAudioBudget(
  usage: VoiceSessionUsageRow,
  additionalSeconds: number,
): Promise<BrakeCheckResult> {
  if (
    usage.traineeAudioSecondsUsed + additionalSeconds >
    SESSION_CONVAI_MAX_SECONDS
  ) {
    return {
      allowed: false,
      reason: "session_trainee_audio_limit",
      fallbackToBrowser: true,
    };
  }
  return { allowed: true, fallbackToBrowser: false };
}

export async function checkSessionExtraTtsBudget(
  usage: VoiceSessionUsageRow,
  additionalChars: number,
): Promise<BrakeCheckResult> {
  if (usage.extraTtsCharsUsed + additionalChars > SESSION_EXTRA_TTS_MAX_CHARS) {
    return {
      allowed: false,
      reason: "session_extra_tts_limit",
      fallbackToBrowser: true,
    };
  }
  return { allowed: true, fallbackToBrowser: false };
}

export function sessionConvaiRemainingSeconds(
  usage: VoiceSessionUsageRow,
): number {
  return Math.max(0, SESSION_CONVAI_MAX_SECONDS - usage.convaiSecondsUsed);
}

export function shouldWarnSessionConvai(usage: VoiceSessionUsageRow): boolean {
  const remaining = sessionConvaiRemainingSeconds(usage);
  return remaining > 0 && remaining <= 30;
}

export async function recordConvaiSeconds(
  client: Client,
  sessionUsageId: string,
  seconds: number,
): Promise<void> {
  const { rows } = await client.query<{
    verified_user_id: string;
    convai_seconds_used: number;
  }>(
    `UPDATE voice_session_usage
     SET convai_seconds_used = convai_seconds_used + $2
     WHERE id = $1
     RETURNING verified_user_id, convai_seconds_used`,
    [sessionUsageId, seconds],
  );
  const row = rows[0];
  if (
    row &&
    row.convai_seconds_used >= MIN_CONVAI_SECONDS_TO_CONSUME_DAILY_SLOT &&
    row.convai_seconds_used - seconds < MIN_CONVAI_SECONDS_TO_CONSUME_DAILY_SLOT
  ) {
    await syncDailyBilledCounter(client, row.verified_user_id);
  }

  const { year, month } = utcYearMonth();
  await client.query(
    `INSERT INTO voice_global_monthly_usage (usage_year, usage_month, convai_seconds_used)
     VALUES ($1, $2, $3)
     ON CONFLICT (usage_year, usage_month)
     DO UPDATE SET
       convai_seconds_used = voice_global_monthly_usage.convai_seconds_used + $3,
       updated_at = now()`,
    [year, month, seconds],
  );
}

export async function recordTraineeAudioSeconds(
  client: Client,
  sessionUsageId: string,
  seconds: number,
): Promise<void> {
  await client.query(
    `UPDATE voice_session_usage
     SET trainee_audio_seconds_used = trainee_audio_seconds_used + $2
     WHERE id = $1`,
    [sessionUsageId, seconds],
  );
}

export async function recordExtraTtsChars(
  client: Client,
  sessionUsageId: string,
  chars: number,
): Promise<void> {
  const { rows } = await client.query<{
    verified_user_id: string;
    extra_tts_chars_used: number;
  }>(
    `UPDATE voice_session_usage
     SET extra_tts_chars_used = extra_tts_chars_used + $2
     WHERE id = $1
     RETURNING verified_user_id, extra_tts_chars_used`,
    [sessionUsageId, chars],
  );
  const row = rows[0];
  if (row && row.extra_tts_chars_used === chars) {
    await syncDailyBilledCounter(client, row.verified_user_id);
  }
}

export async function acquireConvaiSlot(
  client: Client,
  sessionUsageId: string,
): Promise<BrakeCheckResult> {
  const slotCheck = await checkConcurrentConvaiSlots(client);
  if (!slotCheck.allowed) return slotCheck;

  await client.query(
    `UPDATE voice_session_usage SET convai_slot_held = true WHERE id = $1`,
    [sessionUsageId],
  );
  return { allowed: true, fallbackToBrowser: false };
}

export async function releaseConvaiSlot(
  client: Client,
  sessionUsageId: string,
): Promise<void> {
  await client.query(
    `UPDATE voice_session_usage
     SET convai_slot_held = false, convai_slot_released_at = now()
     WHERE id = $1`,
    [sessionUsageId],
  );
}

export async function endVoiceSession(
  client: Client,
  sessionUsageId: string,
): Promise<void> {
  await releaseConvaiSlot(client, sessionUsageId);
  await client.query(
    `UPDATE voice_session_usage SET session_ended_at = now() WHERE id = $1`,
    [sessionUsageId],
  );
}
