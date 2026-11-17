/** Gemini 3.8 TTS unary PCM default (see ai.google.dev speech-generation). */
export const GEMINI_TTS_PCM_SAMPLE_RATE = 24_000;

/** Wrap headerless 16-bit little-endian mono PCM in a minimal WAV container. */
export function wrapLinearPcmAsWav(
  pcm: Buffer,
  sampleRate = GEMINI_TTS_PCM_SAMPLE_RATE,
): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

function isRiffWav(audio: Buffer): boolean {
  return (
    audio.length >= 4 && audio.subarray(0, 4).toString("ascii") === "RIFF"
  );
}

/**
 * Gemini 3.8 TTS returns `audio/wav` on unary generateContent; older preview
 * models could return headerless `audio/l16` PCM at 24 kHz.
 */
export function normalizeGeminiTtsAudioBytes(
  audio: Buffer,
  mimeType?: string,
): Buffer {
  const mime = mimeType?.toLowerCase() ?? "";
  if (mime.includes("l16") || mime.includes("pcm")) {
    return wrapLinearPcmAsWav(audio);
  }
  if (isRiffWav(audio)) {
    return audio;
  }
  return audio;
}