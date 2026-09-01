/** Max wait for billed /api/voice/tts before browser speechSynthesis fallback. */
export const TTS_FETCH_TIMEOUT_MS = 8_000;

/** Max wait for shared Audio element playback before resuming the mic. */
export const TTS_PLAY_TIMEOUT_MS = 30_000;

/** End-of-speech quiet period before voice autosubmit (ms). */
export const AUTOSUBMIT_SILENCE_MS = 1_750;

/** Safety valve when speechSynthesis or Audio never fires onend. */
export const SPEAKING_WATCHDOG_MS = 45_000;

/** Max wait to restart Web Speech after TTS or a turn submit. */
export const STT_RESTART_TIMEOUT_MS = 5_000;
