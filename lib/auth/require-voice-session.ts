import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Client } from "pg";
import { isDatabaseConfigured, withPgClient } from "@/lib/session";
import {
  resolveVoiceUserIdentity,
  resolveVoiceUserIdentityFromJwt,
} from "@/lib/auth/voice-user";
import { getOrCreateVerifiedUser } from "@/lib/voice/usage";

export interface VoiceAuthContext {
  supabaseUserId: string;
  email: string;
  accessToken: string;
  verifiedUserId: string;
}

function extractBearerToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token || null;
}

/** @internal test helper */
export function extractBearerTokenForTest(request: Request): string | null {
  return extractBearerToken(request);
}

/** Validate Supabase access token (email+password session JWT). */
export async function verifySupabaseAccessToken(
  accessToken: string,
): Promise<{ userId: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const supabase = createClient(url, anonKey);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (data.user) {
    // A live session JWT is enough for billed TTS/STT. Do not require
    // email_confirmed_at — Preview and some Supabase projects leave it null.
    return resolveVoiceUserIdentity(data.user);
  }

  const message = error?.message?.toLowerCase() ?? "";
  if (message.includes("email not confirmed")) {
    return resolveVoiceUserIdentityFromJwt(accessToken);
  }

  return null;
}

export async function resolveVoiceAuth(
  request: Request,
): Promise<VoiceAuthContext | NextResponse> {
  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return NextResponse.json(
      { error: "voice_auth_required", fallbackToBrowser: true },
      { status: 401 },
    );
  }

  const user = await verifySupabaseAccessToken(accessToken);
  if (!user) {
    return NextResponse.json(
      { error: "invalid_voice_session", fallbackToBrowser: true },
      { status: 401 },
    );
  }

  let verifiedUserId = user.userId;
  if (isDatabaseConfigured()) {
    try {
      verifiedUserId = await withPgClient((client) =>
        getOrCreateVerifiedUser(client, user.email, user.userId),
      );
    } catch {
      // Usage DB down (Preview often lacks DATABASE_URL): keep the JWT identity
      // so billed TTS/STT still run. Metering is skipped until Postgres is back.
      verifiedUserId = user.userId;
    }
  }

  return {
    supabaseUserId: user.userId,
    email: user.email,
    accessToken,
    verifiedUserId,
  };
}

export function isVoiceAuthContext(
  value: VoiceAuthContext | NextResponse,
): value is VoiceAuthContext {
  return !(value instanceof NextResponse);
}

/** Ensure sessionUsageId belongs to the authenticated verified user. */
export async function assertSessionOwnership(
  client: Client,
  sessionUsageId: string,
  verifiedUserId: string,
): Promise<boolean> {
  const { rows } = await client.query<{ verified_user_id: string }>(
    `SELECT verified_user_id FROM voice_session_usage WHERE id = $1`,
    [sessionUsageId],
  );
  return rows[0]?.verified_user_id === verifiedUserId;
}
