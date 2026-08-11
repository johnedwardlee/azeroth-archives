import { describe, expect, it } from "vitest";
import { CURRENT_CHARACTER_SCHEMA_VERSION, CURRENT_STORE_VERSION, migrateOfflineStore, newCharacter, normalizeCharacter } from "./character-manager";

describe("character save migrations", () => {
  it("creates current-version characters with safe session defaults", () => {
    const character = newCharacter();
    expect(character.schemaVersion).toBe(CURRENT_CHARACTER_SCHEMA_VERSION);
    expect(character.level).toBe(1);
    expect(character.activeEffects).toEqual([]);
    expect(character.inventory).toEqual([]);
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

    expect(character.schemaVersion).toBe(2);
    expect(character.abilities.strength).toBe(16);
    expect(character.abilities.agility).toBe(12);
    expect(character.hitDiceTotal).toBe(5);
    expect(character.hitDiceUsed).toBe(5);
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
    expect(store.characters[0].schemaVersion).toBe(2);
    expect(store.packs.map((pack) => pack.pack.id)).toEqual(["valid"]);
  });
});
