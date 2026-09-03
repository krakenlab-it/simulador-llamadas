import { NextResponse } from "next/server";
import { ScenarioRepository } from "@/lib/scenarios";
import { toPublicRouteError, withPgClient } from "@/lib/session";
import { parseVoiceAgentSettings } from "@/lib/voice/agent-settings";

interface PatchVoiceAgentBody {
  slug?: string;
  voiceAgent?: unknown;
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as PatchVoiceAgentBody;
    const slug = body.slug?.trim();
    if (!slug) {
      return NextResponse.json({ error: "slug is required" }, { status: 400 });
    }

    const voiceAgent = parseVoiceAgentSettings(body.voiceAgent);
    const scenario = await withPgClient(async (client) => {
      const repo = new ScenarioRepository(client);
      return repo.updateVoiceAgent(slug, voiceAgent);
    });

    if (!scenario) {
      return NextResponse.json({ error: "scenario_not_found" }, { status: 404 });
    }

    return NextResponse.json(scenario);
  } catch (error) {
    const mapped = toPublicRouteError(
      error,
      "No se pudieron guardar los ajustes de voz.",
    );
    return NextResponse.json(mapped.body, { status: mapped.status });
  }
}
