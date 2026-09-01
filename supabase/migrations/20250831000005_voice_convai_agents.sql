-- Persist ElevenLabs ConvAI agent id so serverless invocations reuse one agent
-- instead of calling agents/create on every /api/voice/convai request.

CREATE TABLE voice_convai_agents (
  agent_key TEXT PRIMARY KEY,
  elevenlabs_agent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
