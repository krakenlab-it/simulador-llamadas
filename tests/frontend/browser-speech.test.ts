import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  chunkSpeech,
  resetClientPlaybackForTests,
  speakSpanishText,
} from "@/lib/voice/client-playback";
import {
  BROWSER_SPEAK_RESUME_PUMP_MS,
  BROWSER_SPEAK_START_TIMEOUT_MS,
  BROWSER_SPEAK_TIMEOUT_MS,
} from "@/lib/voice/timeouts";

/** Matches the settle delay client-playback leaves after cancel(). */
const SETTLE_MS = 80;

interface FakeUtterance {
  text: string;
  lang: string;
  volume: number;
  rate: number;
  pitch: number;
  voice: unknown;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

const speak = vi.fn<(utterance: FakeUtterance) => void>();
const cancel = vi.fn();
const resume = vi.fn();
let voices: { lang: string; name: string }[] = [];
let voicesListener: (() => void) | null = null;

function spokenUtterances(): FakeUtterance[] {
  return speak.mock.calls.map(([utterance]) => utterance);
}

function lastUtterance(): FakeUtterance {
  const utterance = spokenUtterances().at(-1);
  if (!utterance) throw new Error("nothing was spoken");
  return utterance;
}

describe("speakSpanishText", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetClientPlaybackForTests();
    speak.mockClear();
    cancel.mockClear();
    resume.mockClear();
    voices = [{ lang: "es-MX", name: "Paulina" }];
    voicesListener = null;

    vi.stubGlobal("speechSynthesis", {
      speak,
      cancel,
      resume,
      getVoices: () => voices,
      addEventListener: (event: string, listener: () => void) => {
        if (event === "voiceschanged") voicesListener = listener;
      },
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      class implements FakeUtterance {
        lang = "";
        volume = 1;
        rate = 1;
        pitch = 1;
        voice: unknown = null;
        onstart: (() => void) | null = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      },
    );
  });

  afterEach(() => {
    resetClientPlaybackForTests();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("keeps es-MX on the last cierre line even when only English voices exist", () => {
    voices = [{ lang: "en-US", name: "Samantha" }];
    speakSpanishText("Si no hay fecha en la agenda, no hay reunión.", vi.fn());
    vi.advanceTimersByTime(SETTLE_MS);

    expect(lastUtterance().text).toBe("Si no hay fecha en la agenda, no hay reunión.");
    expect(lastUtterance().lang).toBe("es-MX");
    expect(lastUtterance().voice).not.toEqual({ lang: "en-US", name: "Samantha" });
  });

  it("speaks the Spanish line with a Mexican voice", () => {
    const onDone = vi.fn();
    speakSpanishText("¿Ustedes miden gente real o solo leads?", onDone);

    vi.advanceTimersByTime(SETTLE_MS);

    expect(speak).toHaveBeenCalledTimes(1);
    expect(lastUtterance().text).toBe("¿Ustedes miden gente real o solo leads?");
    expect(lastUtterance().lang).toBe("es-MX");
    expect(lastUtterance().voice).toEqual({ lang: "es-MX", name: "Paulina" });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("reports done once the whole line has been spoken", () => {
    const onDone = vi.fn();
    speakSpanishText("Hola Rodrigo.", onDone);
    vi.advanceTimersByTime(SETTLE_MS);

    const utterance = lastUtterance();
    utterance.onstart?.();
    utterance.onend?.();

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("speaks a long reply in order and reports done only at the end", () => {
    const long = `${"Mire, "}${"nuestro equipo mide leads reales cada semana. ".repeat(6)}`;
    const onDone = vi.fn();
    speakSpanishText(long, onDone);
    vi.advanceTimersByTime(SETTLE_MS);

    let guard = 0;
    while (!onDone.mock.calls.length && guard < 20) {
      guard += 1;
      const utterance = lastUtterance();
      utterance.onstart?.();
      utterance.onend?.();
    }

    expect(speak.mock.calls.length).toBeGreaterThan(1);
    expect(onDone).toHaveBeenCalledTimes(1);
    const spokenText = spokenUtterances()
      .map((u) => u.text)
      .join(" ");
    expect(spokenText).toContain("Mire,");
    expect(spokenText).toContain("leads reales cada semana.");
  });

  it("pumps resume() so Chrome cannot pause itself mid-reply", () => {
    speakSpanishText("Hola Rodrigo.", vi.fn());
    vi.advanceTimersByTime(SETTLE_MS);
    const before = resume.mock.calls.length;

    vi.advanceTimersByTime(BROWSER_SPEAK_RESUME_PUMP_MS * 2);

    expect(resume.mock.calls.length).toBeGreaterThan(before);
  });

  it("retries once when the engine accepts speak() but never starts", () => {
    const onDone = vi.fn();
    speakSpanishText("Hola Rodrigo.", onDone);
    vi.advanceTimersByTime(SETTLE_MS);
    expect(speak).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(BROWSER_SPEAK_START_TIMEOUT_MS + 10);

    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(2);
    expect(lastUtterance().text).toBe("Hola Rodrigo.");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("gives the mic back when the engine stays mute through the retry", () => {
    const onDone = vi.fn();
    speakSpanishText("Hola Rodrigo.", onDone);
    vi.advanceTimersByTime(SETTLE_MS);

    vi.advanceTimersByTime(BROWSER_SPEAK_START_TIMEOUT_MS + 10);
    vi.advanceTimersByTime(BROWSER_SPEAK_START_TIMEOUT_MS + 10);

    expect(speak).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("gives the mic back when an utterance never ends", () => {
    const onDone = vi.fn();
    speakSpanishText("Hola Rodrigo.", onDone);
    vi.advanceTimersByTime(SETTLE_MS);
    lastUtterance().onstart?.();

    vi.advanceTimersByTime(BROWSER_SPEAK_TIMEOUT_MS + 10);

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("gives the mic back when the engine reports an error", () => {
    const onDone = vi.fn();
    speakSpanishText("Hola Rodrigo.", onDone);
    vi.advanceTimersByTime(SETTLE_MS);

    lastUtterance().onerror?.();

    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("waits for voices to load before speaking", () => {
    voices = [];
    speakSpanishText("Hola Rodrigo.", vi.fn());
    vi.advanceTimersByTime(SETTLE_MS);
    expect(speak).not.toHaveBeenCalled();

    voices = [{ lang: "es-MX", name: "Paulina" }];
    voicesListener?.();

    expect(speak).toHaveBeenCalledTimes(1);
    expect(lastUtterance().voice).toEqual({ lang: "es-MX", name: "Paulina" });
  });

  it("speaks anyway when voiceschanged never fires", () => {
    voices = [];
    speakSpanishText("Hola Rodrigo.", vi.fn());

    vi.advanceTimersByTime(SETTLE_MS + 300);

    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("stops without reporting done when the caller cancels", () => {
    const onDone = vi.fn();
    const stop = speakSpanishText("Hola Rodrigo.", onDone);
    vi.advanceTimersByTime(SETTLE_MS);

    stop();
    vi.advanceTimersByTime(BROWSER_SPEAK_TIMEOUT_MS + 10);

    expect(cancel).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("reports done immediately for text with nothing to say", () => {
    const onDone = vi.fn();
    speakSpanishText("   ", onDone);

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(speak).not.toHaveBeenCalled();
  });
});

describe("chunkSpeech", () => {
  it("keeps a short reply intact", () => {
    expect(chunkSpeech("Eso no mueve venta por m².")).toEqual([
      "Eso no mueve venta por m².",
    ]);
  });

  it("splits on sentence boundaries", () => {
    const chunks = chunkSpeech(
      "Primera oración de prueba. Segunda oración de prueba. Tercera oración.",
      40,
    );

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 40)).toBe(true);
    expect(chunks.join(" ")).toBe(
      "Primera oración de prueba. Segunda oración de prueba. Tercera oración.",
    );
  });

  it("splits a runaway sentence on words", () => {
    const chunks = chunkSpeech("palabra ".repeat(40).trim(), 30);

    expect(chunks.every((chunk) => chunk.length <= 30)).toBe(true);
    expect(chunks.join(" ")).toBe("palabra ".repeat(40).trim());
  });

  it("drops text with nothing to say", () => {
    expect(chunkSpeech("   ")).toEqual([]);
  });
});
