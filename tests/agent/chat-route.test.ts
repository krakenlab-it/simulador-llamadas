import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/agent/harness/route";
import { POST } from "@/app/api/agent/chat/route";

describe("agent API routes", () => {
  it("exposes harness bootstrap without secrets", async () => {
    const response = await GET();
    const body = await response.json();
    expect(body.defaultModel).toBe("deepseek-v4-flash");
    expect(body.presets.some((item: { id: string }) => item.id === "coach")).toBe(
      true,
    );
    expect(body.tools.some((item: { id: string }) => item.id === "compare_team_test")).toBe(
      true,
    );
    expect(body.envNames).toContain("DEEPSEEK_API_KEY");
    expect(JSON.stringify(body)).not.toMatch(/sk-|gsk-/);
  });

  it("drafts a local scenario from chat", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: "Crea un gerente de banco que no quiere pauta digital",
            },
          ],
          settings: { runtime: "local" },
          catalog: [],
          draft: null,
        }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.draft.industry).toMatch(/Banca/i);
  });

  it("returns 400 on empty chat", async () => {
    const response = await POST(
      new Request("http://localhost/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ messages: [] }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
