import { afterEach, describe, expect, it } from "vitest";
import { redactSecrets } from "@/lib/voice/provider-result";

describe("redactSecrets", () => {
  const previous = {
    gateway: process.env.AI_GATEWAY_API_KEY,
    oidc: process.env.VERCEL_OIDC_TOKEN,
    deepseek: process.env.DEEPSEEK_API_KEY,
  };

  afterEach(() => {
    if (previous.gateway === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = previous.gateway;
    if (previous.oidc === undefined) delete process.env.VERCEL_OIDC_TOKEN;
    else process.env.VERCEL_OIDC_TOKEN = previous.oidc;
    if (previous.deepseek === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = previous.deepseek;
  });

  it("scrubs gateway, OIDC and direct DeepSeek keys from provider text", () => {
    process.env.AI_GATEWAY_API_KEY = "gateway-secret-value";
    process.env.VERCEL_OIDC_TOKEN = "oidc-secret-value";
    process.env.DEEPSEEK_API_KEY = "deepseek-secret-value";

    const redacted = redactSecrets(
      "failed gateway-secret-value oidc-secret-value deepseek-secret-value",
    );

    expect(redacted).not.toContain("gateway-secret-value");
    expect(redacted).not.toContain("oidc-secret-value");
    expect(redacted).not.toContain("deepseek-secret-value");
    expect(redacted).toContain("[redacted:AI_GATEWAY_API_KEY]");
    expect(redacted).toContain("[redacted:VERCEL_OIDC_TOKEN]");
    expect(redacted).toContain("[redacted:DEEPSEEK_API_KEY]");
  });
});
