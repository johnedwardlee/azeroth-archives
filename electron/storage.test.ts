import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { newCharacter } from "../src/character-manager";
import type { CharacterData } from "../lib/types";

const require = createRequire(import.meta.url);
const { createStorage, STORE_VERSION } = require("./storage.cjs") as {
  STORE_VERSION: number;
  createStorage: (options: {
    getUserDataPath: () => string;
    validatePack: (pack: unknown) => void;
    backupIntervalMs?: number;
  }) => {
    dataPath: () => string;
    backupPath: () => string;
    load: () => Promise<{ version: number; characters: Array<{ id: string; name: string }>; packs: Array<{ pack: { id: string } }>; disabledPackIds: string[]; campaignProfiles: Array<{ id: string; name: string }>; activeCampaignProfileId?: string; onboardingCompleted: boolean; appRole: "player" | "dm"; recovery?: { restoredFrom?: string; migrationBackup?: string } }>;
    saveCharacter: (character: CharacterData) => Promise<CharacterData>;
    savePack: (pack: unknown) => Promise<unknown>;
    setPackEnabled: (id: string, enabled: boolean) => Promise<unknown>;
    saveCampaignState: (state: unknown) => Promise<unknown>;
    replaceStore: (store: unknown) => Promise<unknown>;
  };
};
const { assertContentPack } = require("./content-validation.cjs") as { assertContentPack: (pack: unknown) => void };

const temporaryDirectories: string[] = [];

async function testStorage(backupIntervalMs = 0) {
  const directory = await mkdtemp(path.join(tmpdir(), "azeroth-archives-storage-"));
  temporaryDirectories.push(directory);
  return createStorage({ getUserDataPath: () => directory, validatePack: assertContentPack, backupIntervalMs });
}

function validCharacter(id: string, name: string) {
  return { ...newCharacter(), id, name };
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("desktop storage", () => {
  it("serializes overlapping character saves without losing records", async () => {
    const storage = await testStorage();
    await Promise.all(Array.from({ length: 20 }, (_, index) => storage.saveCharacter(validCharacter(`hero-${index}`, `Hero ${index}`))));

    const store = await storage.load();
    expect(store.characters).toHaveLength(20);
    expect(new Set(store.characters.map((character) => character.id)).size).toBe(20);
  });

  it("recovers the newest valid rotating backup after corruption", async () => {
    const storage = await testStorage();
    await storage.saveCharacter(validCharacter("first", "First Hero"));
    await storage.saveCharacter(validCharacter("second", "Second Hero"));
    await writeFile(storage.dataPath(), "not json", "utf8");

    const recovered = await storage.load();
    expect(recovered.recovery?.restoredFrom).toMatch(/azeroth-archives-data-/);
    expect(recovered.characters.map((character) => character.id)).toEqual(["first"]);
  });

  it("creates a pre-migration backup and upgrades an old store", async () => {
    const storage = await testStorage();
    await writeFile(storage.dataPath(), JSON.stringify({ version: 1, characters: [{ id: "legacy", name: "Legacy" }] }), "utf8");

    const migrated = await storage.load();
    const backups = await readdir(storage.backupPath());
    expect(migrated.version).toBe(STORE_VERSION);
    expect(migrated.recovery?.migrationBackup).toMatch(/pre-migration-v1/);
    expect(backups.some((name) => name.includes("pre-migration-v1"))).toBe(true);
    expect(JSON.parse(await readFile(storage.dataPath(), "utf8")).version).toBe(STORE_VERSION);
  });

  it("rejects malformed packs and future-version stores", async () => {
    const storage = await testStorage();
    const malformedPack = { schemaVersion: "2.0", pack: { id: "bad-pack", name: "Bad Pack", version: "1" }, spells: {} };
    await expect(storage.savePack(malformedPack)).rejects.toThrow(/invalid content pack/i);
    await expect(storage.replaceStore({ version: STORE_VERSION, characters: [], packs: [malformedPack] })).rejects.toThrow(/invalid content pack/i);

    await writeFile(storage.dataPath(), JSON.stringify({ version: STORE_VERSION + 1, characters: [], packs: [] }), "utf8");
    await expect(storage.load()).rejects.toThrow(/newer version/i);
  });

  it("persists enabled state separately from custom pack contents", async () => {
    const storage = await testStorage();
    const pack = { schemaVersion: "2.0", pack: { id: "optional-pack", name: "Optional Pack", version: "1" } };
    await storage.savePack(pack);
    await storage.setPackEnabled("optional-pack", false);
    expect((await storage.load()).disabledPackIds).toEqual(["optional-pack"]);
    await storage.setPackEnabled("optional-pack", true);
    expect((await storage.load()).disabledPackIds).toEqual([]);
  });

  it("persists validated campaign profiles and onboarding preferences", async () => {
    const storage = await testStorage();
    const now = new Date().toISOString();
    const profile = { schemaVersion: 1, id: "campaign", name: "Campaign", startingLevel: 1, startingExperience: 0, allowedPackIds: [], allowedAbilityMethods: ["standard-array"], encumbranceRule: "variant", startingEquipmentRule: "packages-or-gold", allowMulticlass: false, allowOptionalFeats: true, attunementLimit: 3, houseRules: "", createdAt: now, updatedAt: now };
    await storage.saveCampaignState({ campaignProfiles: [profile], activeCampaignProfileId: profile.id, onboardingCompleted: true, appRole: "dm" });
    expect(await storage.load()).toMatchObject({ campaignProfiles: [{ id: "campaign" }], activeCampaignProfileId: "campaign", onboardingCompleted: true, appRole: "dm" });
    await expect(storage.saveCampaignState({ campaignProfiles: [{ ...profile, startingLevel: 50 }], onboardingCompleted: true, appRole: "dm" })).rejects.toThrow(/startingLevel/i);
  });

  it("rejects malformed current-version character data at the desktop boundary", async () => {
    const storage = await testStorage();
    await expect(storage.saveCharacter({ ...validCharacter("bad", "Bad Hero"), abilities: { ...newCharacter().abilities, strength: "lots" } as never })).rejects.toThrow(/abilities\.strength/i);
    await expect(storage.saveCharacter({ ...validCharacter("bad-link", "Bad Link"), attacks: [{ id: "attack", inventoryItemId: "missing-item", name: "Dagger", ability: "agility", proficient: true, bonus: 0, damage: "1d4", damageType: "Piercing", damageBonus: 0, notes: "" }] })).rejects.toThrow(/inventory item/i);
    await expect(storage.replaceStore({ version: STORE_VERSION, characters: [{ ...validCharacter("bad-levels", "Bad Levels"), level: 20, classLevels: [{ className: "Mage", level: 20 }, { className: "Paladin", level: 20 }] }], packs: [], disabledPackIds: [] })).rejects.toThrow(/add up|level/i);
  });
});
