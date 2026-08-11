import { describe, expect, it } from "vitest";
import {
  activeEffectFromSpell,
  attackFromEquipment,
  calculateEncumbrance,
  classTrainingFor,
  concentrationSave,
  featAbilityIncrease,
  featPrerequisiteIssues,
  generatedCharacterActions,
  isIncapacitated,
  multiclassSpellSlots,
  preparedSpellLimitForClasses,
  progressionSpellSlots,
  resolveIncomingDamage,
  syncEffectConditions,
} from "./character-rules";
import { newCharacter } from "../src/character-manager";
import type { SpellDefinition } from "./types";

describe("living sheet rules", () => {
  it("limits class skills to each class list while allowing Bard flexibility", () => {
    expect(classTrainingFor("Warrior").skillOptions).toContain("Athletics");
    expect(classTrainingFor("Warrior").skillOptions).not.toContain("Arcana");
    expect(classTrainingFor("Bard").skillOptions).toEqual([]);
  });

  it("reports feat prerequisites without preventing GM overrides", () => {
    const character = { ...newCharacter(), level: 2, className: "Rogue", abilities: { ...newCharacter().abilities, strength: 10 } };
    const issues = featPrerequisiteIssues({ id: "test", name: "Test", category: "General", prerequisite: "Level 4+, Strength 13+, Martial Weapon proficiency", description: "Test" }, character);
    expect(issues).toEqual(["Requires level 4.", "Requires Strength 13.", "Requires Martial Weapon proficiency."]);
  });

  it("extracts the allowed ability and cap from feat ASI text", () => {
    expect(featAbilityIncrease({ id: "alert", name: "Alert", category: "General", description: "Ability Score Increase: Increase your Agility or Intellect score by 1, to a maximum of 20. More rules." }))
      .toEqual({ options: ["agility", "intellect"], maximum: 20 });
    expect(featAbilityIncrease({ id: "boon", name: "Boon", category: "Epic Boon", description: "Ability Score Increase: Increase one ability score of your choice by 1, to a maximum of 30." })?.options).toHaveLength(6);
  });

  it("exposes only prepared leveled spells as actions and identifies incapacitation", () => {
    const spell = { id: "spell", name: "Spell", level: 1, school: "Evocation", classes: ["Mage"], castingTime: "Action", range: "30 feet", components: "V", duration: "Instantaneous", description: "Test", prepared: false, className: "Mage" };
    const character = { ...newCharacter(), className: "Mage", classLevels: [{ className: "Mage", level: 1 }], spells: [spell] };
    expect(generatedCharacterActions(character, []).some((action) => action.spellId === spell.id)).toBe(false);
    expect(generatedCharacterActions({ ...character, spells: [{ ...spell, prepared: true }] }, []).some((action) => action.spellId === spell.id)).toBe(true);
    expect(isIncapacitated({ conditions: ["Stunned"] })).toBe(true);
    expect(isIncapacitated({ conditions: [" unconscious "] })).toBe(true);
  });

  it("keeps shared effect conditions until the last source ends", () => {
    const first = { id: "first", name: "First", source: "Test", duration: "rounds" as const, remaining: 1, condition: "Stunned" };
    const second = { ...first, id: "second", name: "Second" };
    expect(syncEffectConditions(["Stunned", "Prone"], [first, second], [second])).toEqual(["Stunned", "Prone"]);
    expect(syncEffectConditions(["Stunned", "Prone"], [first, second], [])).toEqual(["Prone"]);
    expect(syncEffectConditions([], [], [first])).toEqual(["Stunned"]);
  });

  it("links generated weapon attacks to one inventory instance", () => {
    const attack = attackFromEquipment({ id: "dagger", name: "Dagger", category: "Simple Melee", damage: "1d4", damageType: "Piercing" }, true, false, "inventory-dagger-2");
    expect(attack).toMatchObject({ contentId: "dagger", inventoryItemId: "inventory-dagger-2" });
  });

  it("calculates variant encumbrance thresholds and penalties", () => {
    const inventory = [{ id: "load", name: "Load", quantity: 1, weight: "105 lb.", category: "Gear", notes: "", equipped: false }];
    const result = calculateEncumbrance(inventory, 10);
    expect(result.level).toBe("heavily-encumbered");
    expect(result.carryingCapacity).toBe(150);
    expect(result.penalty).toContain("Speed −20 ft.");
  });

  it("supports standard-capacity and tracking-only campaign encumbrance", () => {
    const inventory = [{ id: "load", name: "Load", quantity: 1, weight: "105 lb.", category: "Gear", notes: "", equipped: false }];
    expect(calculateEncumbrance(inventory, 10, "standard").level).toBe("unencumbered");
    expect(calculateEncumbrance(inventory, 10, "none").label).toBe("Not enforced");
  });

  it("applies immunity, resistance, and vulnerability in the correct order", () => {
    const character = newCharacter();
    expect(resolveIncomingDamage(11, "Fire", { ...character, damageResistances: ["Fire"] }).adjusted).toBe(5);
    expect(resolveIncomingDamage(11, "Cold", { ...character, damageVulnerabilities: ["Cold"] }).adjusted).toBe(22);
    expect(resolveIncomingDamage(11, "Poison", { ...character, damageImmunities: ["Poison"] }).adjusted).toBe(0);
  });

  it("uses the standard concentration DC and stamina save", () => {
    const character = { ...newCharacter(), savingThrowProficiencies: ["stamina" as const], proficiencyBonus: 3 };
    expect(concentrationSave(character, 12).dc).toBe(10);
    expect(concentrationSave(character, 42).dc).toBe(21);
    expect(concentrationSave(character, 42).modifier).toBe(4);
  });

  it("tracks concentration spell durations", () => {
    const spell: SpellDefinition = {
      id: "test-light",
      name: "Test Light",
      level: 0,
      school: "Illusion",
      classes: ["Mage"],
      castingTime: "Action",
      range: "60 feet",
      components: "V, S",
      duration: "Concentration, up to 1 minute",
      description: "A test effect.",
    };
    const effect = activeEffectFromSpell(spell);
    expect(effect?.concentration).toBe(true);
    expect(effect?.duration).toBe("rounds");
    expect(effect?.remaining).toBe(10);
  });

  it("produces valid spell-slot progressions through level 20", () => {
    for (const className of ["Bard", "Priest", "Paladin", "Hunter", "Sorcerer", "Mage"]) {
      for (let level = 1; level <= 20; level += 1) {
        const slots = progressionSpellSlots(className, "", level);
        expect(slots).not.toBeNull();
        expect(Object.values(slots ?? {}).every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
      }
    }
  });

  it("combines multiclass caster levels and prepared limits", () => {
    const levels = [
      { className: "Mage", level: 3 },
      { className: "Paladin", level: 2 },
      { className: "Warrior", subclassName: "Eldritch Knight", level: 3 },
    ];
    expect(multiclassSpellSlots(levels)).toEqual({ "1": 4, "2": 3, "3": 2 });
    expect(preparedSpellLimitForClasses(levels)).toBeGreaterThan(0);
  });
});
