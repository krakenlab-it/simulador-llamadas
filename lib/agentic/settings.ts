import type { AgenticRuntimeConfig, ToneId } from "./types";

export const AGENTIC_UNLOCK_STORAGE_KEY = "agenticUnlocked";
export const AGENTIC_ENABLED_STORAGE_KEY = "agenticEnabled";
export const AGENTIC_TONE_PREVIEW_KEY = "agenticTonePreview";
export const AGENTIC_DEMO_PASSWORD = "1234";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in demo mode.
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
    window.localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

export function verifyAgenticPassword(password: string): boolean {
  return password.trim() === AGENTIC_DEMO_PASSWORD;
}

export function isAgenticUnlocked(): boolean {
  return readStorage(AGENTIC_UNLOCK_STORAGE_KEY) === "1";
}

export function setAgenticUnlocked(): void {
  writeStorage(AGENTIC_UNLOCK_STORAGE_KEY, "1");
}

export function clearAgenticUnlock(): void {
  removeStorage(AGENTIC_UNLOCK_STORAGE_KEY);
}

export function isAgenticEnabledForSimulations(): boolean {
  return readStorage(AGENTIC_ENABLED_STORAGE_KEY) === "1";
}

export function setAgenticEnabledForSimulations(enabled: boolean): void {
  if (enabled) {
    writeStorage(AGENTIC_ENABLED_STORAGE_KEY, "1");
  } else {
    removeStorage(AGENTIC_ENABLED_STORAGE_KEY);
  }
}

export function getAgenticTonePreview(): ToneId | null {
  const value = readStorage(AGENTIC_TONE_PREVIEW_KEY);
  if (!value) return null;
  return value as ToneId;
}

export function setAgenticTonePreview(toneId: ToneId | null): void {
  if (!toneId) {
    removeStorage(AGENTIC_TONE_PREVIEW_KEY);
    return;
  }
  writeStorage(AGENTIC_TONE_PREVIEW_KEY, toneId);
}

export function readAgenticRuntimeForSession(
  sessionSeed?: string,
): AgenticRuntimeConfig {
  const unlocked = isAgenticUnlocked();
  const enabled = unlocked && isAgenticEnabledForSimulations();
  const toneId = getAgenticTonePreview() ?? undefined;

  return {
    enabled,
    toneId,
    sessionSeed,
  };
}
