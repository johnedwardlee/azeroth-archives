import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { configured, normalizeServiceError, sessionSummary } = require("./live-sync.cjs") as {
  configured: (config: unknown) => boolean;
  normalizeServiceError: (error: unknown, fallback?: string) => Error;
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

  it("turns structured Supabase failures into IPC-safe errors", () => {
    const error = normalizeServiceError({
      code: "42702",
      message: 'column reference "campaign_id" is ambiguous',
      details: "It could refer to a PL/pgSQL variable or a table column.",
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('column reference "campaign_id" is ambiguous It could refer to a PL/pgSQL variable or a table column. [42702]');
  });

  it("uses a useful fallback for empty service failures", () => {
    expect(normalizeServiceError({}, "Invitation redemption failed.").message).toBe("Invitation redemption failed.");
  });
});
