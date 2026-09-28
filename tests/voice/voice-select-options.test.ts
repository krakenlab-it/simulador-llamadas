import { describe, expect, it } from "vitest";
import {
  applyVoiceSelectChange,
  DEFAULT_VOICE_AGENT_SETTINGS,
  listVoiceSelectOptions,
  voiceSelectValue,
} from "@/lib/voice/agent-settings";

describe("voice select options", () => {
  it("includes curated pool voices and clears override for auto", () => {
    const options = listVoiceSelectOptions();
    expect(options.some((o) => o.group === "pool" && o.label.includes("Laura"))).toBe(
      true,
    );
    expect(voiceSelectValue(DEFAULT_VOICE_AGENT_SETTINGS)).toBe("");
    const cleared = applyVoiceSelectChange(
      {
        ...DEFAULT_VOICE_AGENT_SETTINGS,
        voiceOverride: true,
        voiceId: options[0].id,
      },
      "",
    );
    expect(cleared.voiceOverride).toBe(false);
    expect(cleared.voiceId).toBe("");
  });
});
