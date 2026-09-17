import { NextResponse } from "next/server";
import { AgentHarnessError, runAgentChat } from "@/lib/agent/harness";
import { parseAgentHarnessSettings } from "@/lib/agent/settings";
import type { AgentChatMessage, PublicScenarioSummary } from "@/lib/agent/types";
import type { ScenarioAuthoringDraft } from "@/lib/scenarios/authoring";

function parseMessages(raw: unknown): AgentChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is AgentChatMessage =>
        Boolean(item) &&
        typeof item === "object" &&
        (item.role === "user" || item.role === "assistant") &&
        typeof item.content === "string" &&
        typeof item.id === "string",
    )
    .map((item) => ({
      id: item.id,
      role: item.role,
      content: item.content,
    }));
}

function parseCatalog(raw: unknown): PublicScenarioSummary[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (item): item is PublicScenarioSummary =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof item.slug === "string" &&
      typeof item.clientName === "string" &&
      typeof item.clientTitle === "string" &&
      typeof item.isPreset === "boolean" &&
      typeof item.language === "string",
  );
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: unknown;
      settings?: unknown;
      catalog?: unknown;
      draft?: ScenarioAuthoringDraft | null;
    };

    const messages = parseMessages(body.messages);
    if (messages.length === 0) {
      return NextResponse.json(
        { error: "Escribe un mensaje para armar el escenario." },
        { status: 400 },
      );
    }

    const response = await runAgentChat({
      messages,
      settings: parseAgentHarnessSettings(body.settings),
      catalog: parseCatalog(body.catalog),
      draft: body.draft ?? null,
    });

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof AgentHarnessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "No se pudo completar el turno del agente." },
      { status: 500 },
    );
  }
}
