import { describe, expect, it } from "vitest";
import {
  activeEffectFromSpell,
  calculateEncumbrance,
  classTrainingFor,
  concentrationSave,
  featPrerequisiteIssues,
  multiclassSpellSlots,
  preparedSpellLimitForClasses,
  progressionSpellSlots,
  resolveIncomingDamage,
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

  it("calculates variant encumbrance thresholds and penalties", () => {
    const inventory = [{ id: "load", name: "Load", quantity: 1, weight: "105 lb.", category: "Gear", notes: "", equipped: false }];
    const result = calculateEncumbrance(inventory, 10);
    expect(result.level).toBe("heavily-encumbered");
    expect(result.carryingCapacity).toBe(150);
    expect(result.penalty).toContain("Speed −20 ft.");
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
