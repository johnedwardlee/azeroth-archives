import { describe, expect, it } from "vitest";
import { CURRENT_CHARACTER_SCHEMA_VERSION, CURRENT_STORE_VERSION, migrateOfflineStore, newCharacter, normalizeCharacter } from "./character-manager";

describe("character save migrations", () => {
  it("creates current-version characters with safe session defaults", () => {
    const character = newCharacter();
    expect(character.schemaVersion).toBe(CURRENT_CHARACTER_SCHEMA_VERSION);
    expect(character.level).toBe(1);
    expect(character.activeEffects).toEqual([]);
    expect(character.inventory).toEqual([]);
    expect(character.classLevels).toEqual([]);
    expect(character.advancementHistory).toEqual([]);
    expect(character.companions).toEqual([]);
    expect(character.journal).toEqual([]);
  });

  it("migrates a legacy character and clamps unsafe values", () => {
    const character = normalizeCharacter({
      id: "legacy",
      name: "Legacy Hero",
      className: "Warrior",
      level: 5,
      hitDiceUsed: 99,
      temporaryHp: -4,
      deathSaveSuccesses: 8,
      deathSaveFailures: -3,
      exhaustionLevel: 12,
      abilities: { strength: 16 } as never,
    });

    expect(character.schemaVersion).toBe(CURRENT_CHARACTER_SCHEMA_VERSION);
    expect(character.abilities.strength).toBe(16);
    expect(character.abilities.agility).toBe(14);
    expect(character.hitDiceTotal).toBe(5);
    expect(character.hitDiceUsed).toBe(5);
    expect(character.classLevels).toEqual([{ className: "Warrior", subclassName: "", level: 5 }]);
    expect(character.temporaryHp).toBe(0);
    expect(character.deathSaveSuccesses).toBe(3);
    expect(character.deathSaveFailures).toBe(0);
    expect(character.exhaustionLevel).toBe(6);
    expect(character.armorProficiencies).toContain("Heavy Armor");
  });

  it("migrates version-one stores and drops malformed records", () => {
    const store = migrateOfflineStore({
      version: 1,
      characters: [{ id: "one", name: "Old Save", level: 2 }, null, "bad"],
      packs: [{ schemaVersion: "2.0", pack: { id: "valid", name: "Valid", version: "1" } }, { broken: true }],
    });

    expect(store.version).toBe(CURRENT_STORE_VERSION);
    expect(store.characters).toHaveLength(1);
    expect(store.characters[0].schemaVersion).toBe(CURRENT_CHARACTER_SCHEMA_VERSION);
    expect(store.packs.map((pack) => pack.pack.id)).toEqual(["valid"]);
    expect(store.disabledPackIds).toEqual([]);
    expect(store.campaignProfiles).toEqual([]);
    expect(store.onboardingCompleted).toBe(true);
    expect(store.appRole).toBe("player");
  });

  it("rejects stores created by a newer application version", () => {
    expect(() => migrateOfflineStore({ version: CURRENT_STORE_VERSION + 1, characters: [], packs: [] }))
      .toThrow(/newer version/i);
  });

  it("drops content packs that fail the complete runtime schema", () => {
    const store = migrateOfflineStore({
      version: CURRENT_STORE_VERSION,
      characters: [],
      packs: [{ schemaVersion: "2.0", pack: { id: "bad-pack", name: "Bad", version: "1" }, ancestries: {} }],
    });

    expect(store.packs).toEqual([]);
  });

  it("normalizes malformed numeric data, caps multiclass totals, and assigns legacy spells to a class", () => {
    const character = normalizeCharacter({
      id: "unsafe",
      name: "Unsafe",
      level: 20,
      className: "Mage",
      classLevels: [{ className: "Mage", level: 20 }, { className: "Paladin", level: 20 }],
      abilities: { ...newCharacter().abilities, strength: "invalid" } as never,
      currency: { copper: -4, silver: Number.NaN, gold: 12 } as never,
      inventory: [{ id: "bad-stack", name: "Bad stack", quantity: -99, equipped: false, notes: "" }],
      spells: [{ id: "light", name: "Light", level: 0, school: "Evocation", classes: ["Mage"], castingTime: "Action", range: "Touch", components: "V", duration: "1 hour", description: "Light.", prepared: false }],
    });

    expect(character.schemaVersion).toBe(5);
    expect(character.classLevels).toEqual([{ className: "Mage", subclassName: "", level: 20 }]);
    expect(character.abilities.strength).toBe(newCharacter().abilities.strength);
    expect(character.currency).toEqual({ copper: 0, silver: 0, gold: 12 });
    expect(character.inventory[0].quantity).toBe(0);
    expect(character.spells[0]).toMatchObject({ className: "Mage", prepared: true });
  });

  it("repairs legacy effect conditions and weapon-to-inventory links", () => {
    const character = normalizeCharacter({
      id: "legacy-links",
      name: "Legacy Links",
      inventory: [{ id: "dagger-one", contentId: "dagger", name: "Dagger", quantity: 1, equipped: true, notes: "" }],
      attacks: [{ id: "dagger-attack", contentId: "dagger", name: "Dagger", ability: "agility", proficient: true, bonus: 0, damage: "1d4", damageType: "Piercing", damageBonus: 0, notes: "" }],
      activeEffects: [{ id: "stun-effect", name: "Stunned", source: "Test", duration: "rounds", remaining: 1, condition: "Stunned" }],
      conditions: [],
    });

    expect(character.conditions).toContain("Stunned");
    expect(character.attacks[0].inventoryItemId).toBe("dagger-one");
  });

  it("keeps feat spells separate from overlapping class spell lists", () => {
    const character = normalizeCharacter({
      id: "feat-spell-owner",
      name: "Feat Spell Owner",
      className: "Paladin",
      classLevels: [{ className: "Paladin", level: 1 }],
      spells: [{ id: "bless", name: "Bless", level: 1, school: "Enchantment", classes: ["Priest", "Paladin"], castingTime: "Action", range: "30 feet", components: "V", duration: "1 minute", description: "Bless.", prepared: true, className: "Paladin", sourceFeatId: "magic-initiate", castingAbility: "spirit" }],
      featSpellcastingChoices: [{ featId: "magic-initiate", spellList: "Priest", ability: "spirit", cantripIds: [], levelOneSpellId: "bless", freeCastUsed: false }],
    });
    expect(character.spells[0]).toMatchObject({ sourceFeatId: "magic-initiate", castingAbility: "spirit" });
    expect(character.spells[0].className).toBeUndefined();
  });
});
