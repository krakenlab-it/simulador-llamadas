-- Persist ElevenLabs ConvAI agent id so serverless invocations reuse one agent
-- instead of calling agents/create on every /api/voice/convai request.
--
-- DO NOT ENABLE ROW LEVEL SECURITY here without service-role policies.
-- ConvAI is off in this product; this table is still service-role / DATABASE_URL only.

CREATE TABLE voice_convai_agents (
  agent_key TEXT PRIMARY KEY,
  elevenlabs_agent_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
