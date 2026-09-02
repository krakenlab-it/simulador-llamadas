/**
 * Browser playback for the live call: one shared Audio element (so a click on
 * "Iniciar llamada" unlocks billed ElevenLabs TTS later) and a Spanish
 * speechSynthesis fallback that actually speaks.
 */

import {
  loadStoredDeviceId,
  CALL_SPEAKER_STORAGE_KEY,
} from "@/lib/voice/call-devices";
import {
  BROWSER_SPEAK_RESUME_PUMP_MS,
  BROWSER_SPEAK_START_TIMEOUT_MS,
  BROWSER_SPEAK_TIMEOUT_MS,
} from "@/lib/voice/timeouts";

const SPEECH_LANG = "es-MX";

/** Longest utterance handed to the engine; Chrome truncates long ones. */
const MAX_UTTERANCE_CHARS = 180;

/** Let a cancel() settle before the next speak(); back-to-back calls wedge Chrome. */
const CANCEL_SETTLE_MS = 60;

/** Voices load lazily on first use; do not wait forever for `voiceschanged`. */
const VOICES_READY_TIMEOUT_MS = 250;

/** Tiny silent WAV so play() can unlock autoplay in the same user gesture. */
const SILENCE_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;
const unlockListeners = new Set<() => void>();

/**
 * Chrome garbage-collects utterances it is still speaking, which cuts the audio
 * and swallows `onend`. Holding references here keeps them alive.
 */
let liveUtterances: SpeechSynthesisUtterance[] = [];
let resumePump: ReturnType<typeof setInterval> | null = null;

export function isClientPlaybackUnlocked(): boolean {
  return unlocked;
}

export function getSharedCallAudio(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!sharedAudio) {
    try {
      sharedAudio = new Audio();
      sharedAudio.preload = "auto";
      sharedAudio.setAttribute("playsinline", "true");
      const storedSpeaker = loadStoredDeviceId(CALL_SPEAKER_STORAGE_KEY);
      if (storedSpeaker && typeof sharedAudio.setSinkId === "function") {
        void sharedAudio.setSinkId(storedSpeaker).catch(() => undefined);
      }
    } catch {
      return null;
    }
  }
  return sharedAudio;
}

export async function applyCallSpeaker(deviceId: string): Promise<void> {
  const audio = getSharedCallAudio();
  if (!audio || typeof audio.setSinkId !== "function" || !deviceId) return;
  await audio.setSinkId(deviceId);
}

export function onClientPlaybackUnlocked(listener: () => void): () => void {
  if (unlocked) {
    listener();
    return () => undefined;
  }
  unlockListeners.add(listener);
  return () => {
    unlockListeners.delete(listener);
  };
}

function markUnlocked(): void {
  if (unlocked) return;
  unlocked = true;
  for (const listener of unlockListeners) listener();
  unlockListeners.clear();
}

/** Call from a click (Iniciar llamada / Micrófono). Unlocks Audio + speechSynthesis. */
export function unlockClientPlayback(): void {
  if (typeof window === "undefined") return;
  if (unlocked) return;

  const audio = getSharedCallAudio();
  if (audio) {
    audio.muted = false;
    audio.volume = 1;
    audio.src = SILENCE_WAV;
    try {
      const playing = audio.play?.();
      if (playing && typeof playing.then === "function") {
        void playing
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
            markUnlocked();
          })
          .catch(() => undefined);
      }
    } catch {
      // jsdom and some browsers expose play() without a Promise.
    }
  }

  const synth = window.speechSynthesis;
  if (synth) {
    // Drain any stale queue *before* priming. Handing Chrome an utterance and
    // cancelling it in the same tick is what leaves the engine accepting later
    // speak() calls and never speaking them.
    synth.cancel();
    synth.resume();
    const priming = new SpeechSynthesisUtterance(".");
    priming.volume = 0;
    priming.lang = SPEECH_LANG;
    try {
      liveUtterances.push(priming);
      synth.speak(priming);
    } catch {
      // Ignore browsers that reject the priming utterance.
    }
  }

  markUnlocked();
}

export function pickSpanishVoice(
  voices: ReadonlyArray<{ lang: string; name: string }>,
): { lang: string; name: string } | null {
  const normalized = voices.map((voice) => ({
    voice,
    lang: voice.lang.replace(/_/g, "-").toLowerCase(),
  }));
  const match =
    normalized.find(({ lang }) => lang === "es-mx" || lang.startsWith("es-mx-")) ??
    normalized.find(({ lang }) => lang.startsWith("es-us")) ??
    normalized.find(({ lang }) => lang.startsWith("es-es")) ??
    normalized.find(({ lang }) => lang.startsWith("es"));
  return match?.voice ?? null;
}

export function loadBrowserVoices(): SpeechSynthesisVoice[] {
  if (typeof window === "undefined" || !window.speechSynthesis) return [];
  return window.speechSynthesis.getVoices();
}

export function pickVoiceForLocale(
  voices: ReadonlyArray<{ lang: string; name: string }>,
  locale: string,
): { lang: string; name: string } | null {
  const wanted = locale.replace(/_/g, "-").toLowerCase();
  const prefix = wanted.split("-")[0] ?? wanted;
  const normalized = voices.map((voice) => ({
    voice,
    lang: voice.lang.replace(/_/g, "-").toLowerCase(),
  }));
  const match =
    normalized.find(({ lang }) => lang === wanted || lang.startsWith(`${wanted}-`)) ??
    normalized.find(({ lang }) => lang.startsWith(`${prefix}-`)) ??
    normalized.find(({ lang }) => lang === prefix || lang.startsWith(prefix));
  return match?.voice ?? null;
}

export function applySpanishVoice(utterance: SpeechSynthesisUtterance): void {
  applyScenarioVoice(utterance, SPEECH_LANG);
}

export function applyScenarioVoice(
  utterance: SpeechSynthesisUtterance,
  locale: string = SPEECH_LANG,
): void {
  utterance.lang = locale;
  utterance.volume = 1;
  utterance.rate = 1;
  utterance.pitch = 1;
  const voices = loadBrowserVoices();
  const voice = locale.toLowerCase().replace(/_/g, "-").startsWith("es")
    ? pickSpanishVoice(voices)
    : pickVoiceForLocale(voices, locale);
  if (voice) utterance.voice = voice as SpeechSynthesisVoice;
}

/**
 * Split a client reply into utterances the engine reliably finishes. Chrome
 * truncates long utterances, so break on sentence ends and then on words.
 */
export function chunkSpeech(text: string, maxChars = MAX_UTTERANCE_CHARS): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.length <= maxChars) return [trimmed];

  const chunks: string[] = [];
  let current = "";

  const push = (piece: string) => {
    if (!current) {
      current = piece;
      return;
    }
    if (`${current} ${piece}`.length <= maxChars) {
      current = `${current} ${piece}`;
      return;
    }
    chunks.push(current);
    current = piece;
  };

  for (const sentence of trimmed.match(/[^.!?…]+[.!?…]*\s*/g) ?? [trimmed]) {
    const piece = sentence.trim();
    if (!piece) continue;
    if (piece.length <= maxChars) {
      push(piece);
      continue;
    }
    for (const word of piece.split(/\s+/)) push(word);
  }

  if (current) chunks.push(current);
  return chunks;
}

function stopResumePump(): void {
  if (resumePump !== null) {
    clearInterval(resumePump);
    resumePump = null;
  }
}

/** Stop whatever the browser engine is saying and release its timers. */
export function cancelBrowserSpeech(): void {
  stopResumePump();
  liveUtterances = [];
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

/**
 * Speak Spanish text with the browser engine and always report back.
 *
 * This is the audible path whenever billed ElevenLabs TTS fails, so it defends
 * against every way Chrome drops speech silently: utterance garbage collection,
 * the ~15s self-pause, voices not being loaded yet, and speak() being accepted
 * but never started. `onDone` runs exactly once so the caller can release the
 * mic even when nothing was audible.
 */
export function speakSpanishText(
  text: string,
  onDone: () => void,
  locale: string = SPEECH_LANG,
): () => void {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    onDone();
    return () => undefined;
  }

  const synth = window.speechSynthesis;
  const chunks = chunkSpeech(text);
  if (chunks.length === 0) {
    onDone();
    return () => undefined;
  }

  let finished = false;
  let index = 0;
  let startTimer: number | undefined;
  let overallTimer: number | undefined;

  const clearTimers = () => {
    if (startTimer !== undefined) window.clearTimeout(startTimer);
    if (overallTimer !== undefined) window.clearTimeout(overallTimer);
    startTimer = undefined;
    overallTimer = undefined;
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimers();
    stopResumePump();
    liveUtterances = [];
    onDone();
  };

  const speakChunk = (retry: boolean) => {
    if (finished) return;
    const chunk = chunks[index];
    if (chunk === undefined) {
      finish();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(chunk);
    applyScenarioVoice(utterance, locale);
    liveUtterances.push(utterance);

    let started = false;
    const clearStartTimer = () => {
      if (startTimer !== undefined) window.clearTimeout(startTimer);
      startTimer = undefined;
    };

    utterance.onstart = () => {
      started = true;
      clearStartTimer();
    };
    utterance.onend = () => {
      if (finished) return;
      clearStartTimer();
      index += 1;
      speakChunk(false);
    };
    utterance.onerror = () => {
      if (finished) return;
      clearStartTimer();
      finish();
    };

    synth.resume();
    synth.speak(utterance);

    // Chrome accepts speak() and then never starts. One cancel+retry recovers
    // it; a second miss means the engine is dead, so hand the mic back.
    startTimer = window.setTimeout(() => {
      if (finished || started) return;
      if (retry) {
        finish();
        return;
      }
      synth.cancel();
      speakChunk(true);
    }, BROWSER_SPEAK_START_TIMEOUT_MS);
  };

  const begin = () => {
    if (finished) return;
    stopResumePump();
    // Chrome pauses itself partway through longer replies.
    resumePump = setInterval(() => synth.resume(), BROWSER_SPEAK_RESUME_PUMP_MS);
    speakChunk(false);
  };

  const beginWhenVoicesReady = () => {
    if (finished) return;
    if (synth.getVoices().length > 0) {
      begin();
      return;
    }
    let begun = false;
    const onVoices = () => {
      if (begun || finished) return;
      begun = true;
      begin();
    };
    synth.addEventListener?.("voiceschanged", onVoices, { once: true });
    window.setTimeout(onVoices, VOICES_READY_TIMEOUT_MS);
  };

  liveUtterances = [];
  synth.cancel();
  overallTimer = window.setTimeout(finish, BROWSER_SPEAK_TIMEOUT_MS);
  window.setTimeout(beginWhenVoicesReady, CANCEL_SETTLE_MS);

  return () => {
    if (finished) return;
    finished = true;
    clearTimers();
    stopResumePump();
    liveUtterances = [];
    synth.cancel();
  };
}

export async function playSharedAudio(url: string): Promise<void> {
  const audio = getSharedCallAudio();
  if (!audio) throw new Error("audio_unavailable");
  const storedSpeaker = loadStoredDeviceId(CALL_SPEAKER_STORAGE_KEY);
  if (storedSpeaker && typeof audio.setSinkId === "function") {
    try {
      await audio.setSinkId(storedSpeaker);
    } catch {
      // Fall back to the default output device.
    }
  }
  audio.muted = false;
  audio.volume = 1;
  audio.src = url;
  audio.currentTime = 0;
  const playing = audio.play();
  if (playing && typeof playing.then === "function") {
    await playing;
  }
}

/** Wait for playback to finish or time out so the mic can resume. */
export function waitForSharedAudioEnd(timeoutMs: number): Promise<void> {
  const audio = getSharedCallAudio();
  if (!audio) return Promise.resolve();

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      audio.removeEventListener("ended", finish);
      audio.removeEventListener("error", finish);
      window.clearTimeout(timer);
      resolve();
    };
    const timer = window.setTimeout(finish, timeoutMs);
    if (audio.ended) {
      finish();
      return;
    }
    audio.addEventListener("ended", finish);
    audio.addEventListener("error", finish);
  });
}

/** Reset between tests. */
export function resetClientPlaybackForTests(): void {
  unlocked = false;
  unlockListeners.clear();
  stopResumePump();
  liveUtterances = [];
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.src = "";
  }
  sharedAudio = null;
}
