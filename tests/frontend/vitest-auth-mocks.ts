import { vi } from "vitest";

vi.mock("@/lib/auth/context", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({
    session: { user: { id: "test-user", email: "test@example.com" } },
    loading: false,
    signOut: vi.fn(),
  }),
}));

vi.mock("@/lib/auth/voice-session", () => ({
  registerVerifiedVoiceUser: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/hooks/useVoiceConfig", () => ({
  useVoiceConfig: () => ({
    requiresVoiceAuth: false,
    convaiEnabled: false,
  }),
}));
