import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live-sync user interface contract", () => {
  const manager = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
  const syncPanel = readFileSync(new URL("./live-sync-panel.tsx", import.meta.url), "utf8");
  const party = readFileSync(new URL("./dm-party-workspace.tsx", import.meta.url), "utf8");
  const roller = readFileSync(new URL("./party-roll-workspace.tsx", import.meta.url), "utf8");
  const encounter = readFileSync(new URL("./action-dashboard.tsx", import.meta.url), "utf8");
  const preload = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");
  const main = readFileSync(new URL("../electron/main.cjs", import.meta.url), "utf8");

  it("keeps Party controls interactive while locking remote detail views", () => {
    expect(manager).toContain('tab !== "party" && currentDmLiveLocked ? "dm-live-readonly"');
    expect(manager).toContain('if (item === "party" && tab !== "party") setDmFullEditCharacterId(undefined)');
    expect(manager).toContain('if (characterId !== dmPartyCharacterId) setDmFullEditCharacterId(undefined)');
  });

  it("allows the approved DM resource changes without full editing", () => {
    expect(party).toContain('"adjust-current-resource"');
    expect(party).toContain("adjustHitDice");
    expect(party).toContain("adjustInventoryResource");
    expect(party).toContain('"add-inventory-item"');
    expect(party).toContain('"add-known-spell"');
    expect(party).toContain('<DescriptionPicker ariaLabel="Available equipment"');
    expect(party).toContain('<DescriptionPicker ariaLabel="Available spells"');
    expect(party).toContain('className="dm-known-spell-list"');
    expect(party).toContain("sortDmKnownSpells(selected.spells)");
    expect(party).toContain('spell.prepared ? "Prepared" : "Not prepared"');
    expect(party).toContain('aria-label="Custom item name"');
    expect(party).toContain("patchDmInventoryItem");
    expect(party).toContain('"adjust-condition"');
    expect(party).toContain("availableConditions");
    expect(party).toContain("calculateArmorClass(character, equipment)");
    expect(party).toContain("<b>{armor.value}</b> AC");
    expect(party).toContain("Concentrating:");
    expect(party).toContain("<CollapsiblePanel contained className=\"dm-control-section\"");
    expect(party).toContain('<PartyRollWorkspace rolls={rolls} roller="dm"');
    expect(roller).toContain("function rollDice()");
    expect(roller).toContain("clearRollFeed");
    expect(manager).toContain("current.name || current.playerName");
    expect(manager).toContain("clearCampaignRolls(activeLiveCampaignId)");
    expect(preload).toContain('ipcRenderer.invoke("live-sync:clear-rolls"');
    expect(main).toContain('ipcMain.handle("live-sync:clear-rolls"');
  });

  it("publishes rolls from all current dice-producing character surfaces", () => {
    expect(manager).toContain('<ActionDashboard character={character}');
    expect(manager).toContain('onRoll={publishCharacterRoll}');
    expect(manager).toContain('<CombatManager catalog={equipment}');
    expect(manager).toContain('<SpellbookManager catalog={spells}');
    expect(manager).toContain('partyRolls={appRole === "player" ? liveRolls : undefined}');
    expect(encounter).toContain('roller="player"');
  });

  it("labels resource-backed Encounter buttons with their exact spend", () => {
    expect(encounter).toContain("Spend ${cost} ${resourceUnits(resource.name, cost)}");
  });

  it("lets the DM hide rolls while keeping the player feed party-safe", () => {
    expect(roller).toContain("Hide this roll from players");
    expect(roller).toContain("allowHidden && hideRoll");
    expect(party).toContain("allowHidden");
    expect(manager).toContain("window.azerothDesktop.listCampaignRolls(campaignId)");
  });

  it("offers confirmed player unlink and DM removal without deleting local sheets", () => {
    expect(syncPanel).toContain("Confirm unlink");
    expect(syncPanel).toContain("The local sheet was kept.");
    expect(syncPanel).toContain("Delete shared roll history");
    expect(party).toContain("Remove from campaign");
    expect(party).toContain("The player keeps their local sheet.");
    expect(manager).toContain("removeCharacterSyncState");
    expect(manager).toContain("unlinkLiveCharacter");
    expect(preload).toContain('ipcRenderer.invoke("live-sync:unlink-character"');
    expect(main).toContain('ipcMain.handle("live-sync:unlink-character"');
  });

  it("initializes campaigns after sign-in, guards recovery races, and preserves queued edits", () => {
    expect(manager).toContain("[storeLoaded, appRole, liveSyncStatus.authenticated, liveSyncStatus.userId]");
    expect(manager).toContain("liveLinkOperationActive.current");
    expect(manager).toContain("campaignIdForIdentity(campaigns, syncLinksRef.current, appRole)");
    expect(manager).toContain('queuedCharacterPatch(snapshot.character.id, "")');
    expect(manager).toContain("recoveryLink?.campaignId");
    expect(syncPanel).toContain("Generate recovery code");
    expect(preload).toContain("playerName, recoveryCampaignId)");
    expect(main).toContain("playerName, recoveryCampaignId)");
  });

  it("uses server campaign membership for cached link roles and recovery-code generation", () => {
    expect(manager).toContain("const role = campaign.role;");
    expect(manager).toContain("campaign.role !== appRoleRef.current");
    expect(manager).toContain("canManageCampaignAsDm(activeLiveCampaignId, appRoleRef.current, liveSyncStatusRef.current, liveCampaigns)");
    expect(syncPanel).toContain('appRole === "player" && link.role === "player"');
    expect(syncPanel).toContain("canManageCampaignAsDm(link.campaignId, appRole, status, campaigns)");
    expect(syncPanel).toContain('scrollIntoView({ behavior: "smooth", block: "start" })');
    expect(syncPanel).toContain('scrollIntoView({ behavior: "smooth", block: "nearest" })');
  });

  it("wires manual reconnect through the desktop bridge and keeps narrow-window access", () => {
    const styles = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
    expect(preload).toContain('ipcRenderer.invoke("live-sync:reconnect")');
    expect(main).toContain('ipcMain.handle("live-sync:reconnect", () => liveSync.retryConnection())');
    expect(manager).toContain("onReconnect={reconnectLiveSync}");
    expect(manager).toContain("await window.azerothDesktop.reconnectLiveSync()");
    expect(manager).toContain("await initializeLiveSync();");
    expect(manager).toContain('aria-label="Open campaign connection and recovery"');
    expect(manager).toContain('className="button button-outline roster-connection-button"');
    expect(styles).toContain(".topbar-actions .live-sync-button { display: inline-flex;");
    expect(styles.indexOf(".topbar-actions .live-sync-button { display: inline-flex;")).toBeGreaterThan(styles.indexOf(".topbar-actions .button-quiet, .topbar-actions .button-outline"));
  });
});
