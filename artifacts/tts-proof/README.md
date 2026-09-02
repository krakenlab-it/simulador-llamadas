# TTS proof artifact

This folder holds the **live ElevenLabs proof MP3** produced by the TTS proof test.
Generated files are gitignored; only this README is tracked.

## Run locally

```bash
# Required (see .env.example)
export ELEVENLABS_API_KEY=...
export ELEVENLABS_VOICE_ID=...   # library voice OK — premade Sarah fallback on 402
export ELEVENLABS_ENABLED=true   # or omit; defaults on when the key is set

npm test -- tests/voice/tts-proof.test.ts
```

On success the test writes:

| Location | Path |
|----------|------|
| Repo (gitignored) | `artifacts/tts-proof/clinic-line-proof.mp3` |
| Cloud agent artifacts | `/opt/cursor/artifacts/tts-proof/clinic-line-proof.mp3` |

## CI behaviour

If `ELEVENLABS_API_KEY` is **not** set in CI, the live proof tests **skip** with a clear
message (no false green). When the key **is** present, the test hits the real billed path:
`lib/voice/tts` → ElevenLabs (`EXAVITQu4vr4xnSDxMaL` premade fallback on library 402).

The proof uses one short Spanish clinic sentence (~70 chars) to protect the free 10k quota.

## What it proves

- HTTP 200 from `POST /api/voice/tts` (route test, DB/auth mocked only)
- Non-empty MPEG bytes with a valid ID3 or frame-sync header
- Same synthesis stack used in production live calls (not a stub)

## Structured traces

Each billed attempt logs one JSON line: `voice.tts.attempt` (requestId, voice category,
HTTP status, ElevenLabs error code, chars, session quota, fallbackToBrowser, durationMs).
Turn submits log `voice.turn.submit` (round number, 200 vs 409 `rounds_completed` /
`turn_conflict`).
