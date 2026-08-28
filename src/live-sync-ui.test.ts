import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("live-sync user interface contract", () => {
  const manager = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
  const party = readFileSync(new URL("./dm-party-workspace.tsx", import.meta.url), "utf8");
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
    expect(party).toContain('aria-label="Custom item name"');
    expect(party).toContain("patchDmInventoryItem");
    expect(party).toContain("rollDmDice");
    expect(party).toContain("clearRollFeed");
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
  });
});
