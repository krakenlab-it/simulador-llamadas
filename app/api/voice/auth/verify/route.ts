import { NextResponse } from "next/server";
import { withPgClient } from "@/lib/session";
import { getOrCreateVerifiedUser } from "@/lib/voice/usage";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      authUserId?: string;
    };

    if (!body.email?.trim()) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    const verifiedUserId = await withPgClient((client) =>
      getOrCreateVerifiedUser(client, body.email!, body.authUserId),
    );

    return NextResponse.json({ verifiedUserId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
