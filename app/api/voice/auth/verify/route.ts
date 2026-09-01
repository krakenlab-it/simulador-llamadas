import { NextResponse } from "next/server";
import {
  isVoiceAuthContext,
  resolveVoiceAuth,
} from "@/lib/auth/require-voice-session";

/** Register verified voice user from a live Supabase session JWT (email+password). */
export async function POST(request: Request) {
  const auth = await resolveVoiceAuth(request);
  if (!isVoiceAuthContext(auth)) return auth;

  return NextResponse.json({
    verifiedUserId: auth.verifiedUserId,
    email: auth.email,
  });
}
