const fs = require("node:fs/promises");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

function configured(config) {
  try {
    const url = new URL(config?.supabaseUrl ?? "");
    return url.protocol === "https:" && Boolean(config?.publishableKey);
  } catch {
    return false;
  }
}

function sessionSummary(session) {
  return {
    authenticated: Boolean(session?.user),
    anonymous: Boolean(session?.user?.is_anonymous),
    userId: session?.user?.id,
    email: session?.user?.email,
  };
}

function normalizeServiceError(error, fallback = "Live-sync service request failed.") {
  if (error instanceof Error) return error;
  if (typeof error === "string" && error.trim()) return new Error(error.trim());
  if (error && typeof error === "object") {
    const message = [error.message, error.error_description, error.msg].find((value) => typeof value === "string" && value.trim());
    const context = [error.details, error.hint]
      .filter((value, index, values) => typeof value === "string" && value.trim() && value !== message && values.indexOf(value) === index);
    const code = typeof error.code === "string" && error.code.trim() ? `[${error.code.trim()}]` : "";
    const description = [message, ...context, code].filter(Boolean).join(" ");
    if (description) return new Error(description);
  }
  return new Error(fallback);
}

function createLiveSync({ getUserDataPath, safeStorage, config, onEvent = () => undefined }) {
  if (typeof getUserDataPath !== "function") throw new Error("getUserDataPath is required.");
  const sessionPath = () => path.join(getUserDataPath(), "azeroth-archives-sync-session.json");
  const available = configured(config);
  let client;
  let session;
  let activeChannels = [];
  let status = {
    configured: available,
    connection: available ? "signed-out" : "unconfigured",
    authenticated: false,
    anonymous: false,
    message: available ? "Sign in or link a character to begin live sync." : "Live sync is not configured in this build.",
  };

  function publishStatus(patch = {}) {
    status = { ...status, ...patch, ...sessionSummary(session) };
    onEvent({ type: "status", status });
    return status;
  }

  function requireConfigured() {
    if (!available) throw new Error("Live sync is not configured in this build.");
  }

  function requireClient() {
    requireConfigured();
    if (!client) throw new Error("Live sync has not initialized.");
    return client;
  }

  function requireSession() {
    if (!session?.user) throw new Error("Sign in before using live sync.");
    return session;
  }

  async function removeStoredSession() {
    try {
      await fs.unlink(sessionPath());
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  async function persistSession(nextSession) {
    session = nextSession ?? undefined;
    if (!session) {
      await removeStoredSession();
      return;
    }
    if (!safeStorage?.isEncryptionAvailable?.()) throw new Error("Windows credential encryption is unavailable; the sync session was not stored.");
    const encrypted = safeStorage.encryptString(JSON.stringify(session));
    await fs.mkdir(path.dirname(sessionPath()), { recursive: true });
    await fs.writeFile(sessionPath(), JSON.stringify({ version: 1, encrypted: encrypted.toString("base64") }), "utf8");
  }

  async function restoreSession() {
    try {
      const stored = JSON.parse(await fs.readFile(sessionPath(), "utf8"));
      if (stored?.version !== 1 || typeof stored.encrypted !== "string" || !safeStorage?.isEncryptionAvailable?.()) return;
      const decrypted = safeStorage.decryptString(Buffer.from(stored.encrypted, "base64"));
      const parsed = JSON.parse(decrypted);
      const result = await client.auth.setSession({ access_token: parsed.access_token, refresh_token: parsed.refresh_token });
      if (result.error) throw normalizeServiceError(result.error, "The saved live-sync session could not be restored.");
      session = result.data.session ?? undefined;
    } catch (error) {
      if (error?.code !== "ENOENT") await removeStoredSession().catch(() => undefined);
      session = undefined;
    }
  }

  async function initialize() {
    if (!available) return status;
    client = createClient(config.supabaseUrl, config.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false, flowType: "implicit" },
      realtime: { params: { eventsPerSecond: 20 } },
    });
    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession ?? undefined;
      persistSession(nextSession).catch(() => publishStatus({ connection: "error", message: "The live-sync session could not be stored securely." }));
      publishStatus({ connection: nextSession ? "connecting" : "signed-out", message: nextSession ? "Live-sync identity restored." : "Signed out of live sync." });
    });
    await restoreSession();
    return publishStatus({ connection: session ? "connecting" : "signed-out", message: session ? "Live-sync identity restored." : "Sign in or link a character to begin live sync." });
  }

  async function requestDmMagicLink(email) {
    const sync = requireClient();
    const normalized = String(email ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(normalized)) throw new Error("Enter a valid DM email address.");
    const result = await sync.auth.signInWithOtp({ email: normalized, options: { emailRedirectTo: config.authRedirectUrl, shouldCreateUser: true } });
    if (result.error) throw normalizeServiceError(result.error, "The DM sign-in link could not be requested.");
    return publishStatus({ connection: "signed-out", message: `Magic link sent to ${normalized}.` });
  }

  async function handleAuthCallback(callbackUrl) {
    const sync = requireClient();
    const url = new URL(callbackUrl);
    if (url.protocol !== "azeroth-archives:" || url.hostname !== "auth-callback") throw new Error("That authentication callback is invalid.");
    const params = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.search.slice(1));
    const errorDescription = params.get("error_description");
    if (errorDescription) throw new Error(errorDescription);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) throw new Error("The magic link did not include a complete session.");
    const result = await sync.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (result.error) throw normalizeServiceError(result.error, "The DM sign-in session could not be completed.");
    await persistSession(result.data.session);
    return publishStatus({ connection: "connecting", message: "DM sign-in complete." });
  }

  async function ensureAnonymousPlayer() {
    const sync = requireClient();
    if (session?.user?.is_anonymous) return session;
    if (session?.user) throw new Error("Sign out of the DM live-sync account before linking a player character on this installation.");
    const result = await sync.auth.signInAnonymously();
    if (result.error) throw normalizeServiceError(result.error, "The player device identity could not be created.");
    await persistSession(result.data.session);
    publishStatus({ connection: "connecting", message: "Player device identity created." });
    return result.data.session;
  }

  async function signOut() {
    const sync = requireClient();
    await Promise.all(activeChannels.map((channel) => sync.removeChannel(channel)));
    activeChannels = [];
    const result = await sync.auth.signOut();
    if (result.error) throw normalizeServiceError(result.error, "Live sync could not sign out.");
    await persistSession(undefined);
    return publishStatus({ connection: "signed-out", message: "Signed out of live sync." });
  }

  async function listCampaigns() {
    const sync = requireClient();
    requireSession();
    const memberships = await sync.from("campaign_members").select("campaign_id, role, joined_at").is("revoked_at", null);
    if (memberships.error) throw normalizeServiceError(memberships.error, "Campaign memberships could not be loaded.");
    const ids = (memberships.data ?? []).map((entry) => entry.campaign_id);
    if (!ids.length) return [];
    const campaigns = await sync.from("campaigns").select("id, name, created_at, updated_at").in("id", ids);
    if (campaigns.error) throw normalizeServiceError(campaigns.error, "Campaigns could not be loaded.");
    const roleById = new Map((memberships.data ?? []).map((entry) => [entry.campaign_id, entry.role]));
    return (campaigns.data ?? []).map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      role: roleById.get(campaign.id),
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
    }));
  }

  async function createCampaign(name) {
    const sync = requireClient();
    const current = requireSession();
    if (current.user.is_anonymous) throw new Error("A DM email sign-in is required to create campaigns.");
    const result = await sync.rpc("create_campaign", { p_name: String(name ?? "").trim() });
    if (result.error) throw normalizeServiceError(result.error, "The campaign could not be created.");
    return result.data;
  }

  async function createInvitation(campaignId, characterId, validHours = 72) {
    const sync = requireClient();
    requireSession();
    const result = await sync.rpc("create_campaign_invitation", {
      p_campaign_id: campaignId,
      p_character_id: characterId || null,
      p_valid_hours: validHours,
    });
    if (result.error) throw normalizeServiceError(result.error, "The campaign invitation could not be created.");
    const invitation = Array.isArray(result.data) ? result.data[0] : result.data;
    return invitation ? { invitationId: invitation.invitation_id, invitationCode: invitation.invitation_code, expiresAt: invitation.expires_at } : undefined;
  }

  async function redeemInvitation(code, character, playerName) {
    const sync = requireClient();
    await ensureAnonymousPlayer();
    const result = await sync.rpc("redeem_campaign_invitation", {
      p_invitation_code: code,
      p_character_id: character.id,
      p_character_state: character,
      p_player_name: playerName,
    });
    if (result.error) throw normalizeServiceError(result.error, "The campaign invitation could not be redeemed.");
    const redeemed = Array.isArray(result.data) ? result.data[0] : result.data;
    return redeemed ? { campaignId: redeemed.campaign_id, characterId: redeemed.character_id, characterState: redeemed.character_state, revision: Number(redeemed.revision) } : undefined;
  }

  async function listMembers(campaignId) {
    const sync = requireClient();
    requireSession();
    const result = await sync.from("campaign_members").select("campaign_id, user_id, role, display_name, joined_at, revoked_at").eq("campaign_id", campaignId).is("revoked_at", null);
    if (result.error) throw normalizeServiceError(result.error, "Campaign members could not be loaded.");
    return (result.data ?? []).map((member) => ({
      campaignId: member.campaign_id,
      userId: member.user_id,
      role: member.role,
      displayName: member.display_name,
      joinedAt: member.joined_at,
      revokedAt: member.revoked_at ?? undefined,
    }));
  }

  async function listCharacters(campaignId) {
    const sync = requireClient();
    requireSession();
    const result = await sync.from("characters").select("id, campaign_id, owner_user_id, state, revision, updated_at").eq("campaign_id", campaignId).order("updated_at", { ascending: false });
    if (result.error) throw normalizeServiceError(result.error, "Synchronized characters could not be loaded.");
    return (result.data ?? []).map((row) => ({ character: row.state, campaignId: row.campaign_id, ownerUserId: row.owner_user_id, revision: Number(row.revision), updatedAt: row.updated_at }));
  }

  async function applyMutation(mutation) {
    const sync = requireClient();
    requireSession();
    const result = await sync.rpc("apply_character_mutation", {
      p_character_id: mutation.characterId,
      p_mutation_id: mutation.id,
      p_base_revision: mutation.baseRevision,
      p_category: mutation.category,
      p_patch: mutation.patch,
    });
    if (result.error) throw normalizeServiceError(result.error, "The character update could not be synchronized.");
    const applied = Array.isArray(result.data) ? result.data[0] : result.data;
    return applied ? { characterState: applied.character_state, revision: Number(applied.revision), updatedAt: applied.updated_at, wasConflict: Boolean(applied.was_conflict) } : undefined;
  }

  async function recordRoll(event) {
    const sync = requireClient();
    requireSession();
    const result = await sync.rpc("record_roll_event", {
      p_event_id: event.id,
      p_character_id: event.characterId,
      p_actor_name: event.actorName,
      p_category: event.category,
      p_label: event.label,
      p_formula: event.formula,
      p_dice: event.dice,
      p_modifier: event.modifier,
      p_total: event.total,
      p_mode: event.mode,
      p_detail: event.detail,
    });
    if (result.error) throw normalizeServiceError(result.error, "The roll could not be published.");
    return result.data;
  }

  async function listRolls(campaignId) {
    const sync = requireClient();
    requireSession();
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const result = await sync.from("roll_events").select("id, campaign_id, character_id, actor_name, category, label, formula, dice, modifier, total, mode, detail, created_at").eq("campaign_id", campaignId).gte("created_at", cutoff).order("created_at", { ascending: false }).limit(500);
    if (result.error) throw normalizeServiceError(result.error, "Campaign rolls could not be loaded.");
    return (result.data ?? []).map((event) => ({
      kind: "roll-event",
      id: event.id,
      campaignId: event.campaign_id,
      characterId: event.character_id,
      actorName: event.actor_name,
      category: event.category,
      label: event.label,
      formula: event.formula,
      dice: event.dice,
      modifier: event.modifier,
      total: event.total,
      mode: event.mode,
      detail: event.detail,
      createdAt: event.created_at,
    }));
  }

  async function subscribe(campaignId, presence, characterId) {
    const sync = requireClient();
    requireSession();
    await Promise.all(activeChannels.map((channel) => sync.removeChannel(channel)));
    activeChannels = [];
    if (presence?.role === "player" && !characterId) throw new Error("A linked character is required for player live sync.");
    publishStatus({ connection: "connecting", message: "Connecting to the live campaign…" });
    await sync.realtime.setAuth(session.access_token);
    const campaignChannel = sync.channel(`campaign:${campaignId}`, {
      config: { private: true, presence: { key: session.user.id } },
    });
    if (presence?.role === "dm") {
      for (const event of ["INSERT", "UPDATE", "DELETE"]) {
        campaignChannel.on("broadcast", { event }, (payload) => onEvent({ type: "remote-change", campaignId, event, payload }));
      }
    }
    campaignChannel.on("presence", { event: "sync" }, () => onEvent({ type: "presence", campaignId, state: campaignChannel.presenceState() }));
    campaignChannel.on("presence", { event: "join" }, () => onEvent({ type: "presence", campaignId, state: campaignChannel.presenceState() }));
    campaignChannel.on("presence", { event: "leave" }, () => onEvent({ type: "presence", campaignId, state: campaignChannel.presenceState() }));

    async function connectChannel(channel, trackPresence = false) {
      activeChannels.push(channel);
      await new Promise((resolve, reject) => {
        channel.subscribe(async (nextStatus, error) => {
          if (nextStatus === "SUBSCRIBED") {
            if (trackPresence) await channel.track({ ...presence, userId: session.user.id, connectedAt: new Date().toISOString() });
            resolve();
          } else if (["CHANNEL_ERROR", "TIMED_OUT"].includes(nextStatus)) {
            reject(normalizeServiceError(error, "Live campaign connection failed."));
          }
        });
      });
    }

    try {
      await connectChannel(campaignChannel, true);
      if (presence?.role === "player") {
        const characterChannel = sync.channel(`character:${characterId}`, { config: { private: true } });
        for (const event of ["INSERT", "UPDATE", "DELETE"]) {
          characterChannel.on("broadcast", { event }, (payload) => onEvent({ type: "remote-change", campaignId, event, payload }));
        }
        await connectChannel(characterChannel);
      }
    } catch (error) {
      await Promise.all(activeChannels.map((channel) => sync.removeChannel(channel)));
      activeChannels = [];
      publishStatus({ connection: "offline", message: "Live campaign disconnected; local changes will remain queued." });
      throw error;
    }
    publishStatus({ connection: "live", message: "Live campaign connected." });
    return status;
  }

  async function unsubscribe() {
    if (client) await Promise.all(activeChannels.map((channel) => client.removeChannel(channel)));
    activeChannels = [];
    return publishStatus({ connection: session ? "connecting" : "signed-out", message: session ? "Live campaign closed." : "Signed out of live sync." });
  }

  return {
    sessionPath,
    initialize,
    status: () => status,
    requestDmMagicLink,
    handleAuthCallback,
    ensureAnonymousPlayer,
    signOut,
    listCampaigns,
    createCampaign,
    createInvitation,
    redeemInvitation,
    listMembers,
    listCharacters,
    applyMutation,
    recordRoll,
    listRolls,
    subscribe,
    unsubscribe,
  };
}

module.exports = { configured, createLiveSync, normalizeServiceError, sessionSummary };
