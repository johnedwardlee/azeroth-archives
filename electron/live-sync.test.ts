import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { configured, createLiveSync, normalizeServiceError, sessionSummary } = require("./live-sync.cjs") as {
  configured: (config: unknown) => boolean;
  createLiveSync: (options: Record<string, unknown>) => {
    initialize: () => Promise<unknown>;
    retryConnection: () => Promise<unknown>;
    ensureAnonymousPlayer: () => Promise<unknown>;
    subscribe: (campaignId: string, presence: { role: "player"; displayName: string }, characterId: string) => Promise<unknown>;
    unsubscribe: () => Promise<unknown>;
    signOut: () => Promise<unknown>;
    status: () => { connection: string; authenticated: boolean; userId?: string };
    handleAuthCallback: (url: string) => Promise<unknown>;
    redeemInvitation: (code: string, character: Record<string, unknown>, playerName: string, campaignId?: string) => Promise<unknown>;
    previewRecovery: (code: string) => Promise<unknown>;
    recoverFromCode: (code: string, characterId: string, campaignId: string, playerName: string) => Promise<unknown>;
    listCampaigns: () => Promise<Array<{ id: string; name: string; role: string }>>;
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
      expect(channels.map((channel) => channel.topic)).toEqual(["campaign:campaign", "party-rolls:campaign", "character:character"]);

      channels[1].emit("CHANNEL_ERROR", { message: "connection dropped" });
      expect(events).toContainEqual(expect.objectContaining({ type: "status", status: expect.objectContaining({ connection: "offline" }) }));

      await vi.advanceTimersByTimeAsync(4_000);
      expect(channels.map((channel) => channel.topic)).toEqual(["campaign:campaign", "party-rolls:campaign", "character:character", "campaign:campaign", "party-rolls:campaign", "character:character"]);
      expect(events).toContainEqual({ type: "resync", campaignId: "campaign" });
      expect(events).toContainEqual(expect.objectContaining({ type: "status", status: expect.objectContaining({ connection: "live" }) }));
    } finally {
      await liveSync.unsubscribe();
      vi.useRealTimers();
      rmSync(dataPath, { recursive: true, force: true });
    }
  });
});

describe("saved login and player recovery", () => {
  const fixtures: Array<{ directory: string; sync: ReturnType<typeof createLiveSync> }> = [];
  const playerSession = { access_token: "test-access", refresh_token: "test-refresh", user: { id: "player", is_anonymous: true } };

  function fixture(storedSession: unknown = playerSession, restoredSession = playerSession) {
    const directory = mkdtempSync(join(tmpdir(), "azeroth-session-test-"));
    const sessionFile = join(directory, "azeroth-archives-sync-session.json");
    if (storedSession) writeFileSync(sessionFile, JSON.stringify({ version: 1, encrypted: Buffer.from(JSON.stringify(storedSession)).toString("base64") }));
    let notify: (event: string, session: unknown) => void = () => undefined;
    const client = {
      auth: {
        onAuthStateChange: (callback: typeof notify) => { notify = callback; callback("INITIAL_SESSION", null); },
        setSession: vi.fn(async () => {
          notify("SIGNED_IN", restoredSession);
          return { data: { session: restoredSession }, error: null as unknown };
        }),
        signInAnonymously: vi.fn(async () => {
          notify("SIGNED_IN", playerSession);
          return { data: { session: playerSession }, error: null };
        }),
        signOut: vi.fn(async () => { notify("SIGNED_OUT", null); return { error: null }; }),
      },
      realtime: { setAuth: async () => undefined },
      removeChannel: async () => undefined,
      rpc: vi.fn(async (_name: string, _parameters: unknown): Promise<{ data: Array<Record<string, unknown>>; error: unknown }> => ({ data: [{ campaign_id: "campaign", character_id: "hero", character_state: { id: "hero", currentHp: 7 }, revision: 42 }], error: null })),
      from: vi.fn((_table: string): unknown => undefined),
    };
    const sync = createLiveSync({
      getUserDataPath: () => directory,
      safeStorage: { isEncryptionAvailable: () => true, encryptString: (value: string) => Buffer.from(value), decryptString: (value: Buffer) => value.toString("utf8") },
      config: { supabaseUrl: "https://example.supabase.co", publishableKey: "test-key" },
      clientFactory: () => client,
    });
    fixtures.push({ directory, sync });
    return { sync, client, sessionFile, notify: (event: string, value: unknown) => notify(event, value) };
  }

  afterEach(async () => {
    for (const { directory, sync } of fixtures.splice(0)) {
      await sync.signOut();
      rmSync(directory, { recursive: true, force: true });
    }
    vi.useRealTimers();
  });

  it("ignores an empty initial auth event and restores the same player identity", async () => {
    const { sync, client, sessionFile, notify } = fixture();
    await sync.initialize();
    expect(client.auth.setSession).toHaveBeenCalledWith({ access_token: "test-access", refresh_token: "test-refresh" });
    notify("INITIAL_SESSION", null);
    expect(sync.status()).toMatchObject({ authenticated: true, userId: "player" });
    expect(existsSync(sessionFile)).toBe(true);
  });

  it("uses the DM's own membership even when RLS exposes all four player rows", async () => {
    const dmSession = { ...playerSession, user: { id: "dm", is_anonymous: false } };
    const { sync, client } = fixture(dmSession, dmSession);
    const visibleMemberships = [
      { campaign_id: "original", user_id: "dm", role: "dm", revoked_at: null },
      { campaign_id: "empty-duplicate", user_id: "dm", role: "dm", revoked_at: null },
      ...[1, 2, 3, 4].map((index) => ({ campaign_id: "original", user_id: `player-${index}`, role: "player", revoked_at: null })),
      { campaign_id: "revoked", user_id: "dm", role: "dm", revoked_at: "2026-10-01" },
    ];
    const membershipQuery = {
      select: vi.fn(() => membershipQuery),
      eq: vi.fn((_column: string, _value: string) => membershipQuery),
      is: vi.fn(async () => {
        const userId = membershipQuery.eq.mock.calls.at(-1)?.[1];
        return { data: visibleMemberships.filter((row) => (!userId || row.user_id === userId) && !row.revoked_at), error: null };
      }),
    };
    const campaignQuery = {
      select: vi.fn(() => campaignQuery),
      in: vi.fn(async (_column: string, ids: string[]) => ({
        data: ids.map((id) => ({ id, name: "Warcraft: Last Days of Peace" })), error: null,
      })),
    };
    client.from.mockImplementation((table) => table === "campaign_members" ? membershipQuery : campaignQuery);
    await sync.initialize();
    const campaigns = await sync.listCampaigns();
    expect(membershipQuery.eq).toHaveBeenCalledWith("user_id", "dm");
    expect(membershipQuery.is).toHaveBeenCalledWith("revoked_at", null);
    expect(campaignQuery.in).toHaveBeenCalledWith("id", ["original", "empty-duplicate"]);
    expect(campaigns).toEqual([
      expect.objectContaining({ id: "original", role: "dm" }),
      expect.objectContaining({ id: "empty-duplicate", role: "dm" }),
    ]);
  });

  it("does not let other memberships grant a player DM access", async () => {
    const { sync, client } = fixture();
    const membershipQuery = {
      select: vi.fn(() => membershipQuery),
      eq: vi.fn((_column: string, _value: string) => membershipQuery),
      is: vi.fn(async () => ({ data: [{ campaign_id: "original", role: "player" }], error: null })),
    };
    const campaignQuery = {
      select: vi.fn(() => campaignQuery),
      in: vi.fn(async () => ({ data: [{ id: "original", name: "Azeroth" }], error: null })),
    };
    client.from.mockImplementation((table) => table === "campaign_members" ? membershipQuery : campaignQuery);
    await sync.initialize();
    expect(await sync.listCampaigns()).toEqual([expect.objectContaining({ id: "original", role: "player" })]);
    expect(membershipQuery.eq).toHaveBeenCalledWith("user_id", "player");
  });

  it("keeps credentials through offline startup and retries without creating another player", async () => {
    vi.useFakeTimers();
    const { sync, client, sessionFile } = fixture();
    client.auth.setSession.mockResolvedValueOnce({ data: { session: playerSession }, error: { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 } });
    await sync.initialize();
    expect(sync.status()).toMatchObject({ connection: "offline", authenticated: false });
    expect(existsSync(sessionFile)).toBe(true);
    await expect(sync.ensureAnonymousPlayer()).rejects.toThrow("saved player login is reconnecting");
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(10_000);
    await vi.waitFor(() => expect(sync.status()).toMatchObject({ connection: "connecting", authenticated: true, userId: "player" }));
    expect(client.auth.setSession).toHaveBeenCalledTimes(2);
  });

  it("keeps expired credentials until an explicit recovery or sign-out", async () => {
    const { sync, client, sessionFile } = fixture();
    client.auth.setSession.mockResolvedValueOnce({ data: { session: playerSession }, error: { status: 400, code: "refresh_token_not_found", message: "Refresh token expired" } });
    await sync.initialize();
    expect(sync.status()).toMatchObject({ connection: "signed-out", authenticated: false });
    expect(existsSync(sessionFile)).toBe(true);
    await sync.signOut();
    expect(existsSync(sessionFile)).toBe(false);
  });

  it("manually retries an offline login immediately using the original identity", async () => {
    vi.useFakeTimers();
    const { sync, client, sessionFile } = fixture();
    client.auth.setSession.mockResolvedValueOnce({ data: { session: playerSession }, error: { name: "AuthRetryableFetchError", message: "Failed to fetch", status: 0 } });
    await sync.initialize();
    expect(sync.status()).toMatchObject({ connection: "offline", authenticated: false });
    await expect(sync.retryConnection()).resolves.toMatchObject({ authenticated: true, userId: "player", connection: "connecting" });
    expect(client.auth.setSession).toHaveBeenCalledTimes(2);
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(existsSync(sessionFile)).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(client.auth.setSession).toHaveBeenCalledTimes(2);
  });

  it("keeps an authenticated identity when manually reconnecting", async () => {
    const { sync, client } = fixture();
    await sync.initialize();
    await expect(sync.retryConnection()).resolves.toMatchObject({ authenticated: true, userId: "player" });
    expect(client.auth.setSession).toHaveBeenCalledOnce();
    expect(client.auth.signOut).not.toHaveBeenCalled();
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("directs a player with missing credentials to recovery without creating a new identity", async () => {
    const { sync, client } = fixture(null);
    await sync.initialize();
    await expect(sync.retryConnection()).resolves.toMatchObject({ authenticated: false, connection: "signed-out", message: expect.stringContaining("DM recovery code") });
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  it("keeps expired credentials and reports a failed manual retry", async () => {
    const { sync, client, sessionFile } = fixture();
    client.auth.setSession.mockResolvedValue({ data: { session: playerSession }, error: { status: 400, message: "Refresh token expired" } });
    await sync.initialize();
    await expect(sync.retryConnection()).resolves.toMatchObject({ authenticated: false, message: "Refresh token expired" });
    expect(existsSync(sessionFile)).toBe(true);
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("rejects a second manual retry while saved credentials are restoring", async () => {
    const { sync, client } = fixture();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    client.auth.setSession.mockImplementationOnce(async () => {
      await pending;
      return { data: { session: playerSession }, error: null };
    });
    const initialize = sync.initialize();
    await vi.waitFor(() => expect(client.auth.setSession).toHaveBeenCalledOnce());
    try {
      await expect(sync.retryConnection()).rejects.toThrow("already reconnecting");
      expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
    } finally {
      finish();
      await initialize;
    }
  });

  it("does not erase the saved file on an unsolicited signed-out event", async () => {
    const { sync, sessionFile, notify } = fixture();
    await sync.initialize();
    notify("SIGNED_OUT", null);
    expect(sync.status().authenticated).toBe(false);
    expect(existsSync(sessionFile)).toBe(true);
  });

  it("serializes token updates and explicit sign-out so old writes cannot resurrect a login", async () => {
    const { sync, sessionFile, notify } = fixture();
    await sync.initialize();
    notify("TOKEN_REFRESHED", { ...playerSession, refresh_token: "rotated-refresh" });
    await sync.signOut();
    expect(existsSync(sessionFile)).toBe(false);
  });

  it("does not let an in-flight restoration undo an explicit sign-out", async () => {
    const { sync, client, sessionFile } = fixture();
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => { finish = resolve; });
    client.auth.setSession.mockImplementationOnce(async () => {
      await pending;
      return { data: { session: playerSession }, error: null };
    });
    const initialize = sync.initialize();
    await vi.waitFor(() => expect(client.auth.setSession).toHaveBeenCalledOnce());
    await sync.signOut();
    finish();
    await initialize;
    expect(sync.status()).toMatchObject({ connection: "signed-out", authenticated: false });
    expect(existsSync(sessionFile)).toBe(false);
  });

  it("stores a completed magic-link sign-in securely", async () => {
    const { sync, sessionFile } = fixture(null);
    await sync.initialize();
    await sync.handleAuthCallback("azeroth-archives://auth-callback#access_token=new-access&refresh_token=new-refresh");
    expect(sync.status()).toMatchObject({ authenticated: true, connection: "connecting" });
    const stored = JSON.parse(readFileSync(sessionFile, "utf8"));
    expect(JSON.parse(Buffer.from(stored.encrypted, "base64").toString("utf8"))).toEqual(playerSession);
  });

  it("recovers by character and campaign without uploading local sheet contents", async () => {
    const { sync, client } = fixture(null);
    await sync.initialize();
    await expect(sync.redeemInvitation("recovery-code", { id: "hero", currentHp: 999 }, "Player", "campaign")).resolves.toMatchObject({
      characterId: "hero", campaignId: "campaign", characterState: { currentHp: 7 }, revision: 42,
    });
    expect(client.rpc).toHaveBeenCalledWith("recover_campaign_character", { p_invitation_code: "recovery-code", p_character_id: "hero", p_campaign_id: "campaign", p_player_name: "Player" });
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it("keeps ordinary invitation linking working", async () => {
    const { sync, client } = fixture();
    await sync.initialize();
    await sync.redeemInvitation("join-code", { id: "hero" }, "Player");
    expect(client.rpc).toHaveBeenCalledWith("redeem_campaign_invitation", { p_invitation_code: "join-code", p_character_id: "hero", p_character_state: { id: "hero" }, p_player_name: "Player" });
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it("checks a recovery code on a new device without consuming it or sending a local ID", async () => {
    const { sync, client } = fixture(null);
    client.rpc.mockResolvedValueOnce({ data: [{ campaign_id: "campaign", campaign_name: "Azeroth", character_id: "original", character_name: "Jaina", player_name: "", expires_at: "2026-10-04" }], error: null });
    await sync.initialize();
    await expect(sync.previewRecovery("code")).resolves.toMatchObject({ characterId: "original", characterName: "Jaina", campaignId: "campaign" });
    expect(client.rpc).toHaveBeenCalledExactlyOnceWith("preview_campaign_recovery", { p_invitation_code: "code" });
  });

  it("recovers the confirmed server ID without accepting or uploading an imported copy", async () => {
    const { sync, client } = fixture(null);
    await sync.initialize();
    await expect(sync.recoverFromCode("code", "hero", "campaign", "Player")).resolves.toMatchObject({ characterId: "hero", characterState: { id: "hero", currentHp: 7 } });
    expect(client.rpc).toHaveBeenCalledWith("recover_campaign_character_from_code", { p_invitation_code: "code", p_expected_character_id: "hero", p_expected_campaign_id: "campaign", p_player_name: "Player" });
    expect(JSON.stringify(client.rpc.mock.calls)).not.toContain("p_character_state");
  });

  it("requires confirmed IDs and rejects server responses for another sheet", async () => {
    const { sync, client } = fixture();
    await sync.initialize();
    await expect(sync.recoverFromCode("code", "", "campaign", "Player")).rejects.toThrow("confirm its character first");
    expect(client.rpc).not.toHaveBeenCalled();
    await expect(sync.recoverFromCode("code", "other", "campaign", "Player")).rejects.toThrow("does not match");
  });

  it("explains missing code-recovery migrations and mistaken use of recovery codes as new invitations", async () => {
    const { sync, client } = fixture();
    await sync.initialize();
    client.rpc.mockResolvedValueOnce({ data: [], error: { code: "PGRST202", message: "Function not found" } });
    await expect(sync.previewRecovery("code")).rejects.toThrow("202610010002_code_based_recovery.sql");
    client.rpc.mockResolvedValueOnce({ data: [], error: { code: "P0001", message: "This recovery code belongs to a different character." } });
    await expect(sync.redeemInvitation("code", { id: "imported-copy" }, "Player")).rejects.toThrow("Check recovery code");
  });

  it("rejects a recovery response for a different campaign or character", async () => {
    const { sync } = fixture();
    await sync.initialize();
    await expect(sync.redeemInvitation("code", { id: "other" }, "Player", "campaign")).rejects.toThrow("does not match");
    await expect(sync.redeemInvitation("code", { id: "hero" }, "Player", "other-campaign")).rejects.toThrow("does not match");
  });
});
