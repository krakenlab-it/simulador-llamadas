import { describe, expect, it } from "vitest";
import {
  CALL_MIC_STORAGE_KEY,
  CALL_SPEAKER_STORAGE_KEY,
  deviceLabel,
} from "@/lib/voice/call-devices";

describe("call device helpers", () => {
  it("stores stable localStorage keys", () => {
    expect(CALL_MIC_STORAGE_KEY).toContain("Mic");
    expect(CALL_SPEAKER_STORAGE_KEY).toContain("Speaker");
  });

  it("falls back to a readable label when the browser hides device names", () => {
    expect(deviceLabel({ deviceId: "1", kind: "audioinput", label: "", groupId: "g", toJSON: () => ({}) }, "Micrófono 1")).toBe(
      "Micrófono 1",
    );
  });
});
