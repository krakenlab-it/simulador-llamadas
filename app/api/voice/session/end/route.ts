import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import {
  assertSessionOwnership,
  isVoiceAuthContext,
  resolveVoiceAuth,
} from "@/lib/auth/require-voice-session";
import { endVoiceSession } from "@/lib/voice/usage";

export async function POST(request: Request) {
  try {
    const auth = await resolveVoiceAuth(request);
    if (!isVoiceAuthContext(auth)) return auth;

    const body = (await request.json()) as { sessionUsageId?: string };
    if (!body.sessionUsageId) {
      return NextResponse.json(
        { error: "sessionUsageId is required" },
        { status: 400 },
      );
    }

    const owned = await withPgClient((client) =>
      assertSessionOwnership(client, body.sessionUsageId!, auth.verifiedUserId),
    );
    if (!owned) {
      return NextResponse.json(
        { error: "session_forbidden", fallbackToBrowser: true },
        { status: 403 },
      );
    }

    await withPgClient((client) =>
      endVoiceSession(client, body.sessionUsageId!),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
