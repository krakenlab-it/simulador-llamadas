import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/agent/harness/route";
import { POST } from "@/app/api/agent/chat/route";
import { DEFAULT_AGENT_SETTINGS } from "@/lib/agent/settings";

describe("agent harness routes", () => {
  it("returns presets, tools, and env names without secrets", async () => {
    const response = await GET();
    const body = (await response.json()) as {
      presets: Array<{ id: string }>;
      tools: Array<{ id: string }>;
      envNames: string[];
      availability: { groq: boolean };
    };
    expect(body.presets.some((preset) => preset.id === "coach")).toBe(true);
    expect(body.tools.some((tool) => tool.id === "propose_scenario")).toBe(true);
    expect(body.envNames).toContain("GROQ_API_KEY");
    expect(JSON.stringify(body)).not.toMatch(/sk-|gsk_/);
    expect(typeof body.availability.groq).toBe("boolean");
  });

  it("sets up a scenario from conversation on POST /api/agent/chat", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              id: "u1",
              role: "user",
              content: "Crea un gerente de banco que no quiere pauta digital",
            },
          ],
          settings: { ...DEFAULT_AGENT_SETTINGS, runtime: "local" },
          catalog: [],
          draft: null,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      draft: { industry: string; clientName: string };
      runtime: string;
    };
    expect(body.runtime).toBe("local");
    expect(body.draft.industry).toBe("banca");
    expect(body.draft.clientName.length).toBeGreaterThan(2);
  });

  it("rejects an empty chat", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
