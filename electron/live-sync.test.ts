import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { configured, sessionSummary } = require("./live-sync.cjs") as {
  configured: (config: unknown) => boolean;
  sessionSummary: (session: unknown) => { authenticated: boolean; anonymous: boolean; userId?: string; email?: string };
};

describe("desktop live sync boundary", () => {
  it("requires an HTTPS project URL and publishable key", () => {
    expect(configured({ supabaseUrl: "", publishableKey: "" })).toBe(false);
    expect(configured({ supabaseUrl: "http://example.supabase.co", publishableKey: "key" })).toBe(false);
    expect(configured({ supabaseUrl: "https://example.supabase.co", publishableKey: "key" })).toBe(true);
  });

  it("exposes only non-token session identity", () => {
    expect(sessionSummary({ access_token: "secret", user: { id: "user", email: "dm@example.com", is_anonymous: false } })).toEqual({ authenticated: true, anonymous: false, userId: "user", email: "dm@example.com" });
    expect(sessionSummary(undefined)).toEqual({ authenticated: false, anonymous: false, userId: undefined, email: undefined });
  });
});
