import { NextResponse } from "next/server";
import { AgentHarnessError, runAgentChat } from "@/lib/agent";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const response = await runAgentChat(body);
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
