import { describe, expect, it } from "vitest";
import {
  buildConvaiAgentPayload,
  CONVAI_AGENT_KEY,
  CONVAI_CLIENT_EVENTS,
} from "@/lib/voice/providers/elevenlabs";

describe("ConvAI agent payload", () => {
  it("uses client_events as a string list per ElevenLabs agents/create docs", () => {
    const payload = buildConvaiAgentPayload(
      "Mariana Escobedo",
      "Clínica dental · citas",
      "voice-123",
    );

    const clientEvents = (
      payload.conversation_config as {
        conversation: { client_events: unknown };
      }
    ).conversation.client_events;

    expect(Array.isArray(clientEvents)).toBe(true);
    expect(clientEvents).toEqual([...CONVAI_CLIENT_EVENTS]);
    expect(clientEvents).not.toEqual(
      expect.objectContaining({ agent_response: true }),
    );
  });

  it("uses eleven_flash_v2_5 for Spanish ConvAI TTS", () => {
    const payload = buildConvaiAgentPayload("Cliente", "contexto", "voice-123");
    const tts = (payload.conversation_config as {
      tts: { model_id: string; voice_id?: string };
    }).tts;

    expect(tts.model_id).toBe("eleven_flash_v2_5");
    expect(tts.voice_id).toBe("voice-123");
  });

  it("sets Spanish agent language and signed-url auth", () => {
    const payload = buildConvaiAgentPayload("Cliente", "contexto");

    const agent = (payload.conversation_config as { agent: { language: string } })
      .agent;
    expect(agent.language).toBe("es");
    expect(payload.name).toBe(CONVAI_AGENT_KEY);
    expect(
      (payload.platform_settings as { auth: { enable_auth: boolean } }).auth
        .enable_auth,
    ).toBe(true);
  });
});

describe("voice convai agents migration (static)", () => {
  it("persists ElevenLabs agent id for reuse across serverless invocations", async () => {
    const { readFileSync } = await import("fs");
    const { join } = await import("path");
    const sql = readFileSync(
      join(process.cwd(), "supabase/migrations/20250831000005_voice_convai_agents.sql"),
      "utf-8",
    );
    expect(sql).toContain("CREATE TABLE voice_convai_agents");
    expect(sql).toContain("elevenlabs_agent_id");
    expect(sql).toContain("agent_key TEXT PRIMARY KEY");
  });
});
