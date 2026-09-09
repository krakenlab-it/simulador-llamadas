import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AGENTIC_DEMO_PASSWORD,
  AGENTIC_ENABLED_STORAGE_KEY,
  AGENTIC_UNLOCK_STORAGE_KEY,
  clearAgenticUnlock,
  isAgenticUnlocked,
  readAgenticRuntimeForSession,
  setAgenticEnabledForSimulations,
  setAgenticUnlocked,
  verifyAgenticPassword,
} from "@/lib/agentic/settings";

describe("agentic password gate", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      sessionStorage: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] ?? null;
        },
        setItem(key: string, value: string) {
          this.store[key] = value;
        },
        removeItem(key: string) {
          delete this.store[key];
        },
      },
      localStorage: {
        store: {} as Record<string, string>,
        getItem(key: string) {
          return this.store[key] ?? null;
        },
        setItem(key: string, value: string) {
          this.store[key] = value;
        },
        removeItem(key: string) {
          delete this.store[key];
        },
      },
    });
    clearAgenticUnlock();
    setAgenticEnabledForSimulations(false);
  });

  it("rejects wrong password", () => {
    expect(verifyAgenticPassword("0000")).toBe(false);
    expect(isAgenticUnlocked()).toBe(false);
  });

  it("unlocks with demo password 1234", () => {
    expect(verifyAgenticPassword(AGENTIC_DEMO_PASSWORD)).toBe(true);
    setAgenticUnlocked();
    expect(isAgenticUnlocked()).toBe(true);
    expect(window.sessionStorage.getItem(AGENTIC_UNLOCK_STORAGE_KEY)).toBe("1");
  });

  it("includes enabled flag only when unlocked and toggle on", () => {
    setAgenticUnlocked();
    setAgenticEnabledForSimulations(true);
    expect(readAgenticRuntimeForSession("seed-1")).toEqual({
      enabled: true,
      toneId: undefined,
      sessionSeed: "seed-1",
    });

    setAgenticEnabledForSimulations(false);
    expect(readAgenticRuntimeForSession("seed-1").enabled).toBe(false);
    expect(window.localStorage.getItem(AGENTIC_ENABLED_STORAGE_KEY)).toBeNull();
  });
});
