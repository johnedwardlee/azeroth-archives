import { describe, expect, it, vi } from "vitest";
import packJson from "../content-packs/warcraft5e-campaign.w5e?raw";
import {
  activeEffectFromSpell,
  attackFromEquipment,
  calculateArmorClass,
  calculateEncumbrance,
  calculateEffectiveSpeed,
  classTrainingFor,
  concentrationSave,
  featAbilityIncrease,
  featPrerequisiteIssues,
  generatedCharacterActions,
  isIncapacitated,
  multiclassSpellSlots,
  levelTwoReconciliationPatch,
  missingLevelTwoFeatures,
  outstandingLevelTwoPrompts,
  preparedSpellLimitForClasses,
  progressionSpellSlots,
  resolveIncomingDamage,
  resolvedRollMode,
  rollD20,
  spellDamageProfile,
  spellHealingProfile,
  spellListsGrantedByFeats,
  spellMatchesLists,
  spellSaveAbility,
  startingHitPoints,
  startingSpellRequirementsFor,
  syncEffectConditions,
  syncFeatResources,
  syncMulticlassResources,
} from "./character-rules";
import { newCharacter } from "../src/character-manager";
import type { ContentPack, SpellDefinition, TrackedSpell } from "./types";

const campaignPack = JSON.parse(packJson) as ContentPack;

describe("living sheet rules", () => {
  it("includes the current Stamina modifier in level-one hit points", () => {
    expect(startingHitPoints(10, 13)).toBe(11);
    expect(startingHitPoints(10, 16)).toBe(13);
    expect(startingHitPoints(6, 1)).toBe(1);
  });

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

  it("audits every bundled class level 2 grant and fresh choice", () => {
    const classes = campaignPack.classes ?? [];
    expect(classes.map((definition) => definition.name)).toEqual(["Barbarian", "Bard", "Priest", "Warrior", "Monk", "Paladin", "Hunter", "Rogue", "Sorcerer", "Mage"]);
    for (const definition of classes) {
      const legacy = { ...newCharacter(), className: definition.name, level: 2, classLevels: [{ className: definition.name, level: 2 }], features: [] };
      expect(missingLevelTwoFeatures(legacy, classes).map((grant) => grant.feature.name))
        .toEqual((definition.levelFeatures["2"] ?? []).map((feature) => feature.name));
      const reconciled = levelTwoReconciliationPatch(legacy, classes, campaignPack.spells ?? []);
      expect(reconciled.features?.map((feature) => feature.name)).toEqual((definition.levelFeatures["2"] ?? []).map((feature) => feature.name));
    }
  });

  it("retroactively prompts for every unresolved level 2 class choice", () => {
    const classes = campaignPack.classes ?? [];
    const spells = campaignPack.spells ?? [];
    const expected: Record<string, Array<[string, string, number]>> = {
      Barbarian: [],
      Bard: [["Expertise", "expertise", 2], ["Bard Spellcasting", "spell", 1]],
      Priest: [["Priest Spellcasting", "spell", 1]],
      Warrior: [],
      Monk: [],
      Paladin: [["Fighting Style", "fighting-style", 1], ["Paladin Spellcasting", "spell", 1]],
      Hunter: [["Deft Explorer", "expertise", 1], ["Fighting Style", "fighting-style", 1], ["Hunter Spellcasting", "spell", 1]],
      Rogue: [],
      Sorcerer: [["Metamagic", "metamagic", 2], ["Sorcerer Spellcasting", "spell", 2]],
      Mage: [["Arcane Scholar", "expertise", 1], ["Mage Spellcasting", "spell", 2]],
    };
    for (const definition of classes) {
      const levelOneRequirement = startingSpellRequirementsFor(definition.name, 1);
      const baselineSpells: TrackedSpell[] = levelOneRequirement
        ? spells.filter((spell) => spell.level === 1 && spell.classes.includes(definition.name)).slice(0, levelOneRequirement.learned).map((spell) => ({ ...spell, prepared: true, className: definition.name }))
        : [];
      const legacy = { ...newCharacter(), className: definition.name, level: 2, classLevels: [{ className: definition.name, level: 2 }], features: [], spells: baselineSpells };
      const prompts = outstandingLevelTwoPrompts(legacy, classes);
      expect(prompts.map((prompt) => [prompt.featureName, prompt.kind, prompt.count]), definition.name).toEqual(expected[definition.name]);
    }
  });

  it("supports both level 2 Fighting Style cantrip alternatives", () => {
    const classes = campaignPack.classes ?? [];
    const paladin = classes.find((definition) => definition.name === "Paladin")!;
    const hunter = classes.find((definition) => definition.name === "Hunter")!;
    expect(outstandingLevelTwoPrompts({ ...newCharacter(), classLevels: [{ className: "Paladin", level: 2 }] }, classes).find((prompt) => prompt.kind === "fighting-style")?.cantripAlternative)
      .toMatchObject({ label: "Blessed Warrior", spellList: "Priest", count: 2 });
    expect(outstandingLevelTwoPrompts({ ...newCharacter(), classLevels: [{ className: "Hunter", level: 2 }] }, classes).find((prompt) => prompt.kind === "fighting-style")?.cantripAlternative)
      .toMatchObject({ label: "Nature Warrior", spellList: "Nature", count: 2 });
    expect(paladin.levelFeatures["2"]).toBeTruthy();
    expect(hunter.levelFeatures["2"]).toBeTruthy();
  });

  it("restores Paladin's always-prepared Divine Smite and tracks its free cast", () => {
    const character = { ...newCharacter(), className: "Paladin", level: 2, classLevels: [{ className: "Paladin", level: 2 }] };
    const patch = levelTwoReconciliationPatch(character, campaignPack.classes ?? [], campaignPack.spells ?? []);
    expect(patch.spells).toContainEqual(expect.objectContaining({ id: "divine-smite", prepared: true, alwaysPrepared: true, sourceFeatId: "paladin-2-paladin-s-smite", castingAbility: "spirit" }));
    expect(patch.featSpellcastingChoices).toContainEqual(expect.objectContaining({ featId: "paladin-2-paladin-s-smite", sourceName: "Paladin's Smite", levelOneSpellId: "divine-smite", freeCastUsed: false }));
  });

  it("refreshes stale pre-audit level 2 feature text from the bundled pack", () => {
    const stale = {
      ...newCharacter(),
      className: "Warrior",
      level: 2,
      classLevels: [{ className: "Warrior", level: 2 }],
      features: [{ id: "fighter-2-action-surge", name: "Action Surge", description: "Old placeholder text." }],
    };
    const patch = levelTwoReconciliationPatch(stale, campaignPack.classes ?? [], campaignPack.spells ?? []);
    expect(patch.features?.find((feature) => feature.id === "fighter-2-action-surge")?.description).toContain("additional action");
    expect(patch.features).toContainEqual(expect.objectContaining({ id: "fighter-2-tactical-mind" }));
  });

  it("tracks level 2 limited-use features and applies Monk Unarmored Movement", () => {
    const warriorResources = syncMulticlassResources([], [{ className: "Warrior", level: 2 }], newCharacter().abilities);
    expect(warriorResources).toContainEqual(expect.objectContaining({ name: "Action Surge", current: 1, maximum: 1, recovery: "short" }));
    const actionSurge = { id: "fighter-2-action-surge", name: "Action Surge", description: "Take one additional action. Once you use this feature, you can't do so again until a Short or Long Rest." };
    const warrior = { ...newCharacter(), className: "Warrior", classLevels: [{ className: "Warrior", level: 2 }], features: [actionSurge], resources: warriorResources };
    expect(generatedCharacterActions(warrior, [])).toContainEqual(expect.objectContaining({ name: "Action Surge", resourceId: warriorResources.find((resource) => resource.name === "Action Surge")?.id, resourceCost: 1 }));
    const monkResources = syncMulticlassResources([], [{ className: "Monk", level: 2 }], newCharacter().abilities);
    expect(monkResources).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Focus Points", maximum: 2 }),
      expect.objectContaining({ name: "Uncanny Metabolism", maximum: 1, recovery: "long" }),
    ]));
    const monk = {
      ...newCharacter(),
      className: "Monk",
      classLevels: [{ className: "Monk", level: 2 }],
      speed: 30,
      features: [{ id: "monk-2-unarmored-movement", name: "Unarmored Movement", description: "Your speed increases while unarmored." }],
    };
    expect(calculateEffectiveSpeed(monk, calculateEncumbrance([], monk.abilities.strength), []).value).toBe(40);
    const uncanny = { id: "monk-2-uncanny-metabolism", name: "Uncanny Metabolism", description: "Regain all expended Focus Points and Hit Points. Once used, it returns after a Long Rest." };
    const uncannyAction = generatedCharacterActions({ ...monk, features: [...monk.features, uncanny], resources: monkResources }, []).find((action) => action.name === "Uncanny Metabolism");
    expect(uncannyAction).toMatchObject({ resourceId: monkResources.find((resource) => resource.name === "Uncanny Metabolism")?.id, resourceCost: 1 });
  });

  it("exposes only prepared leveled spells as actions and identifies incapacitation", () => {
    const spell = { id: "spell", name: "Spell", level: 1, school: "Evocation", classes: ["Mage"], castingTime: "Action", range: "30 feet", components: "V", duration: "Instantaneous", description: "Test", prepared: false, className: "Mage" };
    const character = { ...newCharacter(), className: "Mage", classLevels: [{ className: "Mage", level: 1 }], spells: [spell] };
    expect(generatedCharacterActions(character, []).some((action) => action.spellId === spell.id)).toBe(false);
    expect(generatedCharacterActions({ ...character, spells: [{ ...spell, prepared: true }] }, []).some((action) => action.spellId === spell.id)).toBe(true);
    expect(isIncapacitated({ conditions: ["Stunned"] })).toBe(true);
    expect(isIncapacitated({ conditions: [" unconscious "] })).toBe(true);
  });

  it("automatically tracks Lucky uses by proficiency bonus and preserves spent points", () => {
    const lucky = { id: "lucky", name: "Lucky", category: "Origin", description: "Luck Points: You can spend 1 Luck Point to gain Advantage." };
    const initial = syncFeatResources([], [lucky], 3);
    expect(initial).toEqual([expect.objectContaining({ name: "Luck Points", current: 3, maximum: 3, recovery: "long", automatic: true, source: "Feat: Lucky" })]);
    expect(syncFeatResources(initial, [lucky], 3)).toBe(initial);

    const spent = initial.map((resource) => ({ ...resource, current: 2 }));
    const leveled = syncFeatResources(spent, [lucky], 4);
    expect(leveled[0]).toMatchObject({ current: 3, maximum: 4 });
    expect(syncMulticlassResources(leveled, [{ className: "Warrior", level: 5 }], newCharacter().abilities).some((resource) => resource.name === "Luck Points")).toBe(true);
    expect(syncFeatResources(leveled, [], 4).some((resource) => resource.name === "Luck Points")).toBe(false);
  });

  it("connects the Lucky encounter action to its automatic point tracker", () => {
    const lucky = { id: "lucky", name: "Lucky", category: "Origin", description: "Luck Points: You can spend 1 Luck Point to gain Advantage." };
    const character = { ...newCharacter(), feats: [lucky], resources: syncFeatResources([], [lucky], 2) };
    expect(generatedCharacterActions(character, [])).toContainEqual(expect.objectContaining({ name: "Lucky", resourceId: character.resources[0].id, resourceCost: 1 }));
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

  it("creates distinct Monk Focus choices and tracks every paid option", () => {
    const focusResource = { id: "focus", name: "Focus Points", current: 10, maximum: 10, recovery: "short" as const, automatic: true, source: "Monk" };
    const character = {
      ...newCharacter(),
      className: "Monk",
      classLevels: [{ className: "Monk", level: 10 }],
      resources: [focusResource],
      features: [
        { id: "monk-2-monks-focus", name: "Monk’s Focus", description: "Flurry of Blows, Patient Defense, and Step of the Wind use Focus Points." },
        { id: "monk-10-heightened-focus", name: "Heightened Focus", description: "Flurry of Blows makes three Unarmed Strikes." },
        { id: "monk-3-deflect-attacks", name: "Deflect Attacks", description: "When hit, take a Reaction. If damage is reduced to 0, you can expend 1 Focus Point to redirect the force." },
        { id: "monk-5-stunning-strike", name: "Stunning Strike", description: "When you hit, you can expend 1 Focus Point to force a Stamina saving throw or Stun the target." },
        { id: "monk-18-superior-defense", name: "Superior Defense", description: "At the start of your turn, expend 3 Focus Points to gain Resistance." },
        { id: "monk-2-uncanny-metabolism", name: "Uncanny Metabolism", description: "When you roll Initiative, regain all expended Focus Points." },
      ],
    };
    const actions = generatedCharacterActions(character, []);
    expect(actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "Flurry of Blows", timing: "bonus", resourceId: "focus", resourceCost: 1, description: expect.stringContaining("three Unarmed Strikes") }),
      expect.objectContaining({ name: "Patient Defense — Disengage", timing: "bonus" }),
      expect.objectContaining({ name: "Patient Defense — Disengage + Dodge", resourceId: "focus", resourceCost: 1 }),
      expect.objectContaining({ name: "Step of the Wind — Dash" }),
      expect.objectContaining({ name: "Step of the Wind — Disengage + Dash", resourceId: "focus", resourceCost: 1 }),
      expect.objectContaining({ name: "Deflect Attacks", timing: "reaction", resourceId: "focus", resourceCost: 1 }),
      expect.objectContaining({ name: "Stunning Strike", timing: "other", resourceId: "focus", resourceCost: 1 }),
      expect.objectContaining({ name: "Superior Defense", timing: "other", resourceId: "focus", resourceCost: 3 }),
      expect.objectContaining({ name: "Uncanny Metabolism", timing: "passive" }),
    ]));
    expect(actions.find((action) => action.name === "Patient Defense — Disengage")).not.toHaveProperty("resourceId");
    expect(actions.find((action) => action.name === "Step of the Wind — Dash")).not.toHaveProperty("resourceId");
    expect(actions.find((action) => action.name === "Uncanny Metabolism")?.resourceId).toBeUndefined();
    expect(actions.filter((action) => action.source === "Monk’s Focus")).toHaveLength(5);
    expect(actions.some((action) => action.name === "Monk’s Focus")).toBe(false);
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

  it("resolves Priest healing dice, spellcasting modifiers, upcasting, and mixed healing/damage spells", () => {
    const cureWounds = { level: 1, description: "A creature regains a number of Hit Points equal to 2d8 plus your spellcasting ability modifier. The healing increases by 2d8 for each spell slot level above 1." };
    expect(spellHealingProfile(cureWounds, 3)).toEqual({ formula: "6d8", addsSpellcastingModifier: true });
    const prayer = { level: 2, description: "The targets regain 2d8 Hit Points. The healing increases by 1d8 for each spell slot level above 2." };
    expect(spellHealingProfile(prayer, 4)).toEqual({ formula: "4d8", addsSpellcastingModifier: false });
    const naaru = { id: "conjure-celestial", name: "Call Naaru", level: 7, description: "Healing Light. The target regains Hit Points equal to 4d12 plus your spellcasting ability modifier. Searing Light. The target takes 6d12 Radiant damage." };
    expect(spellHealingProfile(naaru, 7)).toEqual({ formula: "4d12", addsSpellcastingModifier: true });
    expect(spellDamageProfile(naaru, 7, 13)?.formula).toBe("6d12");
  });

  it("uses imported equipment rules for consumable encounter actions", () => {
    const character = { ...newCharacter(), inventory: [{ id: "potion", contentId: "potion-of-healing", name: "Potion of Healing", quantity: 1, equipped: false, notes: "" }] };
    const equipment = [{ id: "potion-of-healing", name: "Potion of Healing", category: "Gear", description: "As a Bonus Action, you can drink or administer this potion. The creature regains 2d4 + 2 Hit Points." }];
    expect(generatedCharacterActions(character, equipment)).toContainEqual(expect.objectContaining({ id: "item-potion", timing: "bonus", purpose: "healing", description: expect.stringContaining("2d4 + 2") }));
  });

  it("calculates equipped armor and shield AC for shared quick views", () => {
    const catalog = [
      { id: "chain-mail", name: "Chain Mail", category: "Heavy Armor", description: "Armor Class (Ac): 16; Strength: Str 13; Stealth: Disadvantage." },
      { id: "shield", name: "Shield", category: "Shield", description: "Armor Class (Ac): +2." },
    ];
    const character = { ...newCharacter(), armorClass: 10, inventory: [
      { id: "worn-mail", contentId: "chain-mail", name: "Chain Mail", quantity: 1, equipped: true, notes: "" },
      { id: "worn-shield", contentId: "shield", name: "Shield", quantity: 1, equipped: true, notes: "" },
    ] };
    expect(calculateArmorClass(character, catalog)).toEqual({ value: 18, automatic: true, source: "Chain Mail + Shield" });
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
