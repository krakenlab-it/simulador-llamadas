/**
 * Browser playback for the live call: one shared Audio element (so a click on
 * "Iniciar llamada" unlocks billed ElevenLabs TTS later) and a Spanish
 * speechSynthesis fallback that actually speaks.
 */

import {
  loadStoredDeviceId,
  CALL_SPEAKER_STORAGE_KEY,
} from "@/lib/voice/call-devices";

const SPEECH_LANG = "es-MX";

/** Tiny silent WAV so play() can unlock autoplay in the same user gesture. */
const SILENCE_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let sharedAudio: HTMLAudioElement | null = null;
let unlocked = false;
const unlockListeners = new Set<() => void>();

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
    synth.resume();
    const priming = new SpeechSynthesisUtterance(" ");
    priming.volume = 0;
    priming.lang = SPEECH_LANG;
    try {
      synth.speak(priming);
      synth.cancel();
      synth.resume();
    } catch {
      // Ignore browsers that reject empty utterances.
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

export function applySpanishVoice(utterance: SpeechSynthesisUtterance): void {
  utterance.lang = SPEECH_LANG;
  utterance.volume = 1;
  utterance.rate = 1;
  utterance.pitch = 1;
  const voice = pickSpanishVoice(loadBrowserVoices());
  if (voice) utterance.voice = voice as SpeechSynthesisVoice;
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
    return;
  }
}

/** Reset between tests. */
export function resetClientPlaybackForTests(): void {
  unlocked = false;
  unlockListeners.clear();
  if (sharedAudio) {
    sharedAudio.pause();
    sharedAudio.src = "";
  }
  sharedAudio = null;
}
