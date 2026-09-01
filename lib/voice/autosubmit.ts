import { AUTOSUBMIT_MIN_WORDS } from "@/lib/voice/timeouts";

/** True when a voice transcript is long enough to autosubmit. */
export function isAutosubmitReady(text: string): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length >= AUTOSUBMIT_MIN_WORDS;
}
