import { readFileSync } from "fs";

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function base64UrlEncode(data: string | Buffer): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function readServiceAccount(): ServiceAccountCredentials | null {
  const path = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!path) return null;

  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as ServiceAccountCredentials;
  } catch {
    return null;
  }
}

async function signJwt(
  creds: ServiceAccountCredentials,
  scope: string,
): Promise<string> {
  const crypto = await import("crypto");
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope,
      aud: creds.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${payload}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  const signature = base64UrlEncode(sign.sign(creds.private_key));
  return `${unsigned}.${signature}`;
}

/** OAuth access token for Google Cloud APIs (Speech, TTS). */
export async function getGoogleAccessToken(
  scope = "https://www.googleapis.com/auth/cloud-platform",
): Promise<string | null> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const creds = readServiceAccount();
  if (!creds?.client_email || !creds.private_key) return null;

  try {
    const jwt = await signJwt(creds, scope);
    const response = await fetch(creds.token_uri ?? "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) return null;

    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return data.access_token;
  } catch {
    return null;
  }
}

export function getGcpProjectId(): string | null {
  return process.env.GCP_PROJECT_ID?.trim() ?? null;
}
