import { describe, expect, it } from "vitest";
import { pickSpanishVoice } from "@/lib/voice/client-playback";

describe("pickSpanishVoice", () => {
  it("prefers Mexican Spanish over generic Spanish", () => {
    const picked = pickSpanishVoice([
      { lang: "en-US", name: "Samantha" },
      { lang: "es-ES", name: "Monica" },
      { lang: "es-MX", name: "Paulina" },
    ]);
    expect(picked?.name).toBe("Paulina");
  });

  it("accepts underscore locale tags", () => {
    const picked = pickSpanishVoice([{ lang: "es_MX", name: "Paulina" }]);
    expect(picked?.name).toBe("Paulina");
  });

  it("falls back to any Spanish voice", () => {
    const picked = pickSpanishVoice([
      { lang: "en-GB", name: "Daniel" },
      { lang: "es-AR", name: "Diego" },
    ]);
    expect(picked?.name).toBe("Diego");
  });

  it("returns null when there is no Spanish voice", () => {
    expect(pickSpanishVoice([{ lang: "en-US", name: "Samantha" }])).toBeNull();
  });
});
