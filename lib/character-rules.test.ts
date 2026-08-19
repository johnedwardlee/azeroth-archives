import { describe, expect, it, vi } from "vitest";
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
  resolvedRollMode,
  rollD20,
  spellDamageProfile,
  spellListsGrantedByFeats,
  spellMatchesLists,
  spellSaveAbility,
  startingSpellRequirementsFor,
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

  it("makes Magic Initiate cantrips available to a Paladin with the Acolyte background feat", () => {
    const feat = { description: "Two Cantrips: you learn two cantrips of your choice from the Priest, Nature, or Mage spell list." };
    const lists = spellListsGrantedByFeats([feat]);
    expect(lists).toEqual(["Priest", "Nature", "Mage"]);
    expect(spellMatchesLists({ classes: ["Priest", "Cleric"] }, lists)).toBe(true);
    expect(spellMatchesLists({ classes: ["Nature (Druid rules list)"] }, lists)).toBe(true);
    expect(spellMatchesLists({ classes: ["Mage", "Wizard"] }, lists)).toBe(true);
    expect(spellMatchesLists({ classes: ["Paladin"] }, lists)).toBe(false);
  });

  it("reports starting spell baselines for every core caster", () => {
    expect(startingSpellRequirementsFor("Paladin", 1)).toEqual({ cantrips: 0, learned: 2, prepared: 2 });
    expect(startingSpellRequirementsFor("Sorcerer", 1)).toEqual({ cantrips: 4, learned: 2, prepared: 2 });
    expect(startingSpellRequirementsFor("Mage", 1)).toEqual({ cantrips: 3, learned: 6, prepared: 4 });
    expect(startingSpellRequirementsFor("Warrior", 1)).toBeNull();
  });

  it("exposes only prepared leveled spells as actions and identifies incapacitation", () => {
    const spell = { id: "spell", name: "Spell", level: 1, school: "Evocation", classes: ["Mage"], castingTime: "Action", range: "30 feet", components: "V", duration: "Instantaneous", description: "Test", prepared: false, className: "Mage" };
    const character = { ...newCharacter(), className: "Mage", classLevels: [{ className: "Mage", level: 1 }], spells: [spell] };
    expect(generatedCharacterActions(character, []).some((action) => action.spellId === spell.id)).toBe(false);
    expect(generatedCharacterActions({ ...character, spells: [{ ...spell, prepared: true }] }, []).some((action) => action.spellId === spell.id)).toBe(true);
    expect(isIncapacitated({ conditions: ["Stunned"] })).toBe(true);
    expect(isIncapacitated({ conditions: [" unconscious "] })).toBe(true);
  });

  it("adds standard actions and active companion commands to the encounter library", () => {
    const character = {
      ...newCharacter(),
      companions: [{ id: "wolf", name: "Wolf", kind: "companion" as const, active: true, currentHp: 11, maxHp: 11, armorClass: 13, speed: "40 ft.", description: "Bite a nearby enemy.", notes: "", source: "Test" }],
    };
    const actions = generatedCharacterActions(character, []);
    expect(actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "standard-dodge", timing: "action", purpose: "defense" }),
      expect.objectContaining({ id: "standard-move", timing: "movement" }),
      expect.objectContaining({ id: "companion-wolf", purpose: "companion" }),
    ]));
  });

  it("resolves normal, advantage, and disadvantage d20 rolls", () => {
    const random = vi.spyOn(Math, "random");
    random.mockReturnValueOnce(0.45).mockReturnValueOnce(0.1).mockReturnValueOnce(0.9).mockReturnValueOnce(0.2).mockReturnValueOnce(0.8);
    expect(rollD20("normal")).toMatchObject({ dice: [10], kept: 10 });
    expect(rollD20("advantage")).toMatchObject({ dice: [3, 19], kept: 19 });
    expect(rollD20("disadvantage")).toMatchObject({ dice: [5, 17], kept: 5 });
    expect(resolvedRollMode("advantage", true)).toBe("normal");
    expect(resolvedRollMode("normal", true)).toBe("disadvantage");
    random.mockRestore();
  });

  it("resolves spell damage, automatic missiles, upcasting, cantrip scaling, and legacy save names", () => {
    const missiles = { id: "magic-missile", name: "Arcane Missiles", level: 1, description: "You create three glowing darts. Each dart deals 1d4 + 1 Force damage. The spell creates one more dart for each spell slot level above 1." };
    expect(spellDamageProfile(missiles, 1, 1)).toMatchObject({ formula: "1d4+1", damageType: "Force", instances: 3, instanceLabel: "dart", automatic: true });
    expect(spellDamageProfile(missiles, 3, 1)?.instances).toBe(5);
    const burningHands = { id: "burning-hands", name: "Burning Hands", level: 1, description: "Each creature makes an Agility saving throw, taking 3d6 Fire damage. The damage increases by 1d6 for each spell slot level above 1." };
    expect(spellDamageProfile(burningHands, 3, 1)).toMatchObject({ formula: "5d6", instances: 1, automatic: false });
    const fireBolt = { id: "fire-bolt", name: "Fire Bolt", level: 0, description: "Make a ranged spell attack. On a hit, the target takes 1d10 Fire damage. Cantrip Upgrade. The damage increases by 1d10 when you reach levels 5, 11, and 17." };
    expect(spellDamageProfile(fireBolt, 0, 11)?.formula).toBe("3d10");
    expect(spellSaveAbility("The target makes a Constitution saving throw.")).toBe("stamina");
    expect(spellSaveAbility("The target makes a Wisdom saving throw.")).toBe("spirit");
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

  it("retains legacy variant encumbrance only when explicitly requested", () => {
    const inventory = [{ id: "load", name: "Load", quantity: 1, weight: "105 lb.", category: "Gear", notes: "", equipped: false }];
    const result = calculateEncumbrance(inventory, 10, "variant");
    expect(result.level).toBe("heavily-encumbered");
    expect(result.carryingCapacity).toBe(150);
    expect(result.penalty).toContain("Speed −20 ft.");
  });

  it("uses standard 5e capacity by default and supports tracking-only campaigns", () => {
    const inventory = [{ id: "load", name: "Load", quantity: 1, weight: "105 lb.", category: "Gear", notes: "", equipped: false }];
    expect(calculateEncumbrance(inventory, 10)).toMatchObject({ rule: "standard", level: "unencumbered", carryingCapacity: 150, speedPenalty: 0 });
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
