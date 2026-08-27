import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { configured, createLiveSync, normalizeServiceError, sessionSummary } = require("./live-sync.cjs") as {
  configured: (config: unknown) => boolean;
  createLiveSync: (options: Record<string, unknown>) => {
    initialize: () => Promise<unknown>;
    ensureAnonymousPlayer: () => Promise<unknown>;
    subscribe: (campaignId: string, presence: { role: "player"; displayName: string }, characterId: string) => Promise<unknown>;
    unsubscribe: () => Promise<unknown>;
  };
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

  it("rebuilds failed player channels and requests a snapshot resync", async () => {
    vi.useFakeTimers();
    const dataPath = mkdtempSync(join(tmpdir(), "azeroth-live-sync-"));
    const events: Array<Record<string, unknown>> = [];
    const channels: Array<{ topic: string; emit: (status: string, error?: unknown) => void }> = [];
    const session = { access_token: "player-token", refresh_token: "refresh-token", user: { id: "player-user", is_anonymous: true } };
    const client = {
      auth: {
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => undefined } } }),
        signInAnonymously: async () => ({ data: { session }, error: null }),
        setSession: async () => ({ data: { session }, error: null }),
      },
      realtime: { setAuth: async () => undefined },
      removeChannel: async () => undefined,
      channel: (topic: string) => {
        let subscriptionCallback: ((status: string, error?: unknown) => void) | undefined;
        const channel = {
          topic,
          on: () => channel,
          track: async () => undefined,
          presenceState: () => ({}),
          subscribe: (callback: (status: string, error?: unknown) => void) => {
            subscriptionCallback = callback;
            queueMicrotask(() => callback("SUBSCRIBED"));
            return channel;
          },
          emit: (status: string, error?: unknown) => subscriptionCallback?.(status, error),
        };
        channels.push(channel);
        return channel;
      },
    };
    const liveSync = createLiveSync({
      getUserDataPath: () => dataPath,
      safeStorage: {
        isEncryptionAvailable: () => true,
        encryptString: (value: string) => Buffer.from(value),
        decryptString: (value: Buffer) => value.toString("utf8"),
      },
      config: { supabaseUrl: "https://example.supabase.co", publishableKey: "publishable", authRedirectUrl: "azeroth-archives://auth-callback" },
      clientFactory: () => client,
      onEvent: (event: Record<string, unknown>) => events.push(event),
    });

    try {
      await liveSync.initialize();
      await liveSync.ensureAnonymousPlayer();
      await liveSync.subscribe("campaign", { role: "player", displayName: "Player" }, "character");
      expect(channels.map((channel) => channel.topic)).toEqual(["campaign:campaign", "character:character"]);

      channels[1].emit("CHANNEL_ERROR", { message: "connection dropped" });
      expect(events).toContainEqual(expect.objectContaining({ type: "status", status: expect.objectContaining({ connection: "offline" }) }));

      await vi.advanceTimersByTimeAsync(4_000);
      expect(channels.map((channel) => channel.topic)).toEqual(["campaign:campaign", "character:character", "campaign:campaign", "character:character"]);
      expect(events).toContainEqual({ type: "resync", campaignId: "campaign" });
      expect(events).toContainEqual(expect.objectContaining({ type: "status", status: expect.objectContaining({ connection: "live" }) }));
    } finally {
      await liveSync.unsubscribe();
      vi.useRealTimers();
      rmSync(dataPath, { recursive: true, force: true });
    }
  });
});
