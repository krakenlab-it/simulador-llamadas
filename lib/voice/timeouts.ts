/** Max wait for billed /api/voice/tts before browser speechSynthesis fallback. */
export const TTS_FETCH_TIMEOUT_MS = 8_000;

/**
 * Whole-ladder budget for the billed ElevenLabs call inside the route. Must stay
 * below TTS_FETCH_TIMEOUT_MS so the server always answers (and logs why it
 * failed) before the browser gives up and aborts the request.
 */
export const TTS_PROVIDER_TIMEOUT_MS = 6_000;

/** Below this much remaining budget a second ElevenLabs attempt is pointless. */
export const TTS_PROVIDER_RETRY_FLOOR_MS = 1_200;

/** Max wait for shared Audio element playback before resuming the mic. */
export const TTS_PLAY_TIMEOUT_MS = 30_000;

/** End-of-speech quiet period before voice autosubmit (ms). */
export const AUTOSUBMIT_SILENCE_MS = 1_750;

/** Safety valve when speechSynthesis or Audio never fires onend. */
export const SPEAKING_WATCHDOG_MS = 45_000;

/** Max wait to restart Web Speech after TTS or a turn submit. */
export const STT_RESTART_TIMEOUT_MS = 5_000;

/**
 * How long a browser speechSynthesis utterance may run before we give up and
 * release the mic. Chrome silently drops utterances; without this the call
 * would sit on "Reanudando micrófono…" until the speaking watchdog fires.
 */
export const BROWSER_SPEAK_TIMEOUT_MS = 20_000;

/**
 * If speechSynthesis has not fired `onstart` within this window the engine
 * swallowed the utterance — cancel and speak it once more.
 */
export const BROWSER_SPEAK_START_TIMEOUT_MS = 1_200;

/** Chrome pauses synthesis after ~15s; pump resume() on this interval. */
export const BROWSER_SPEAK_RESUME_PUMP_MS = 5_000;
