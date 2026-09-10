import "@/tests/frontend/vitest-auth-mocks";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AgenticGate } from "@/app/components/agentic/AgenticGate";
import {
  AGENTIC_UNLOCK_STORAGE_KEY,
  clearAgenticUnlock,
} from "@/lib/agentic/settings";

describe("AgenticGate UI", () => {
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
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("shows soft error on wrong password and unlocks with 1234", async () => {
    const user = userEvent.setup();
    const onUnlocked = vi.fn();

    render(<AgenticGate open onClose={() => undefined} onUnlocked={onUnlocked} />);

    await user.type(screen.getByLabelText(/clave/i), "0000");
    await user.click(screen.getByRole("button", { name: /desbloquear/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/incorrecta/i);
    expect(onUnlocked).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/clave/i));
    await user.type(screen.getByLabelText(/clave/i), "1234");
    await user.click(screen.getByRole("button", { name: /desbloquear/i }));

    expect(onUnlocked).toHaveBeenCalledTimes(1);
    expect(window.sessionStorage.getItem(AGENTIC_UNLOCK_STORAGE_KEY)).toBe("1");
  });
});
