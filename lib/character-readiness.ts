import { classTrainingFor, featPrerequisiteIssues, preparedSpellLimitFor, progressionSpellSlots, spellcastingAbilityForClass, spellListsGrantedByFeats, spellMatchesLists, startingHitPoints, startingSpellRequirementsFor } from "./character-rules";
import type {
  AncestryDefinition,
  BackgroundDefinition,
  CampaignProfile,
  CharacterData,
  ClassDefinition,
  FeatDefinition,
  SpellDefinition,
} from "./types";

export type ReadinessSeverity = "error" | "warning";
export type ReadinessIssue = {
  id: string;
  severity: ReadinessSeverity;
  title: string;
  detail: string;
};

export type CharacterReadinessContext = {
  ancestries: AncestryDefinition[];
  classes: ClassDefinition[];
  backgrounds: BackgroundDefinition[];
  feats: FeatDefinition[];
  spells: SpellDefinition[];
  loadedPackIds: string[];
  campaignProfile?: CampaignProfile;
};

export type CharacterReadinessReport = {
  ready: boolean;
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
  checkedAt: string;
};

const pointBuyCosts: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };

function push(issues: ReadinessIssue[], severity: ReadinessSeverity, id: string, title: string, detail: string) {
  issues.push({ id, severity, title, detail });
}

function ancestryTraitChoiceId(trait: AncestryDefinition["traits"][number]) {
  return trait.id ?? `ancestry-trait-${trait.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

export function evaluateCharacterReadiness(character: CharacterData, context: CharacterReadinessContext): CharacterReadinessReport {
  const issues: ReadinessIssue[] = [];
  const selectedAncestry = context.ancestries.find((entry) => entry.name === character.ancestry);
  const primaryClass = context.classes.find((entry) => entry.name === character.className);
  const selectedBackground = context.backgrounds.find((entry) => entry.name === character.background);
  const training = classTrainingFor(character.className);

  if (!character.name.trim() || character.name.trim().toLowerCase() === "new hero") push(issues, "error", "identity-name", "Name the character", "Replace the draft name before finalizing.");
  if (!character.playerName.trim()) push(issues, "error", "identity-player", "Add the player name", "The DM review file needs to identify the player.");
  if (!character.ancestry) push(issues, "error", "identity-ancestry", "Choose an ancestry", "An ancestry is required.");
  else if (!selectedAncestry) push(issues, "error", "identity-ancestry-missing", "Ancestry content is unavailable", `${character.ancestry} is not present in the enabled campaign content.`);
  if (!character.className || !character.classLevels.length) push(issues, "error", "identity-class", "Choose a class", "At least one class level is required.");
  else if (!primaryClass) push(issues, "error", "identity-class-missing", "Class content is unavailable", `${character.className} is not present in the enabled campaign content.`);
  if (!character.background) push(issues, "error", "identity-background", "Choose a background", "A background is required.");
  else if (!selectedBackground) push(issues, "error", "identity-background-missing", "Background content is unavailable", `${character.background} is not present in the enabled campaign content.`);

  if (selectedAncestry) {
    const skillTrait = selectedAncestry.traits.find((trait) => trait.name === "Skillful" || trait.name === "Keen Senses");
    if (skillTrait) {
      const featureId = ancestryTraitChoiceId(skillTrait);
      const choice = character.advancementChoices.find((entry) => entry.featureId === featureId && entry.level === 1)?.selections[0];
      const allowed = skillTrait.name === "Keen Senses" ? ["Insight", "Perception", "Survival"] : null;
      if (!choice || (allowed && !allowed.includes(choice)) || !character.skillProficiencies.includes(choice)) push(issues, "error", `ancestry-skill-${featureId}`, `Complete ${skillTrait.name}`, allowed ? `Choose Insight, Perception, or Survival as the proficiency granted by ${skillTrait.name}.` : `Choose the skill proficiency granted by ${skillTrait.name}.`);
    }
    const featTrait = selectedAncestry.traits.find((trait) => trait.name === "Versatile");
    if (featTrait) {
      const featureId = ancestryTraitChoiceId(featTrait);
      const featId = character.advancementChoices.find((entry) => entry.featureId === featureId && entry.level === 1)?.selections[0];
      const selectedFeat = context.feats.find((feat) => feat.id === featId && feat.category.toLowerCase() === "origin");
      if (!selectedFeat || !character.feats.some((feat) => feat.id === selectedFeat.id) || selectedFeat.id === selectedBackground?.featId) push(issues, "error", `ancestry-feat-${featureId}`, "Choose the Versatile Origin feat", "Human Versatile grants one Origin feat in addition to the background feat; choose a different feat from the one granted by the background.");
      else if (["skilled", "crafter", "musician"].includes(selectedFeat.id)) {
        const selections = character.advancementChoices.find((entry) => entry.featureId === `origin-feat-${selectedFeat.id}` && entry.level === 1)?.selections ?? [];
        if (selections.length !== 3 || new Set(selections).size !== 3) push(issues, "error", `ancestry-feat-options-${selectedFeat.id}`, `Complete ${selectedFeat.name}`, `Choose all three proficiencies granted by ${selectedFeat.name}.`);
      }
    }
    const magicTrait = selectedAncestry.traits.find((trait) => trait.name === "High Elf Lineage" || trait.name === "Rock Gnome Lineage");
    if (magicTrait) {
      const featureId = ancestryTraitChoiceId(magicTrait);
      const choice = character.featSpellcastingChoices.find((entry) => entry.featId === featureId);
      const requiredSpellIds = magicTrait.name === "High Elf Lineage" ? ["prestidigitation"] : ["mending", "prestidigitation"];
      if (magicTrait.name === "High Elf Lineage" && character.level >= 3) requiredSpellIds.push("detect-magic");
      if (magicTrait.name === "High Elf Lineage" && character.level >= 5) requiredSpellIds.push("misty-step");
      const complete = Boolean(choice?.ability && ["intellect", "spirit", "charisma"].includes(choice.ability) && requiredSpellIds.every((id) => character.spells.some((spell) => spell.id === id && spell.sourceFeatId === featureId && spell.castingAbility === choice.ability)));
      if (!complete) push(issues, "error", `ancestry-magic-${featureId}`, `Complete ${magicTrait.name}`, "Choose the ancestry spellcasting ability and confirm its granted cantrips are recorded.");
    }
    if (selectedAncestry.traits.some((trait) => trait.name === "Dwarven Resilience") && !character.damageResistances.some((entry) => entry.toLowerCase() === "poison")) push(issues, "error", "ancestry-dwarf-poison", "Add Dwarven Resilience", "Dwarven Resilience should add Poison damage resistance to the living sheet.");
    if (primaryClass && character.level === 1 && selectedAncestry.traits.some((trait) => trait.name === "Dwarven Toughness")) {
      const toughBonus = character.feats.some((feat) => feat.id === "tough") ? 2 : 0;
      const expected = startingHitPoints(primaryClass.hitDie, character.abilities.stamina) + 1 + toughBonus;
      if (character.maxHp !== expected) push(issues, "error", "ancestry-dwarf-hp", "Apply Dwarven Toughness", `Level-one maximum Hit Points should be ${expected}, including Dwarven Toughness.`);
    }
  }

  if (!character.abilityScoresConfirmed) push(issues, "error", "abilities-unconfirmed", "Review the ability scores", "Confirm the completed ability assignment in Guided Setup.");
  if (character.abilityScoreMethod === "point-buy") {
    const scores = Object.values(character.baseAbilities);
    const spent = scores.reduce((total, score) => total + (pointBuyCosts[score] ?? 99), 0);
    if (spent !== 27 || scores.some((score) => score < 8 || score > 15)) push(issues, "error", "abilities-point-buy", "Correct point buy", `Point buy currently spends ${spent} of 27 points.`);
  }
  if (selectedBackground?.abilityOptions?.length) {
    const total = Object.values(character.backgroundAbilityBonuses).reduce((sum, value) => sum + (value ?? 0), 0);
    const invalid = Object.entries(character.backgroundAbilityBonuses).some(([ability, value]) => !selectedBackground.abilityOptions?.includes(ability as keyof CharacterData["abilities"]) || (value ?? 0) > 2);
    if (total !== 3 || invalid) push(issues, "error", "abilities-background", "Complete background ability boosts", "Assign three points among the abilities allowed by the selected background, with no more than +2 to one score.");
  }

  if (primaryClass && character.classSkillChoices.length !== training.skillChoices) {
    push(issues, "error", "training-skills", "Complete class skill choices", `Choose ${training.skillChoices} class skill${training.skillChoices === 1 ? "" : "s"}; ${character.classSkillChoices.length} selected.`);
  }
  if (training.masteryChoices && character.weaponMasteries.length < training.masteryChoices) {
    push(issues, "error", "training-masteries", "Complete weapon masteries", `Choose ${training.masteryChoices} mastered weapons; ${character.weaponMasteries.length} selected.`);
  }
  const hasStartingExpertise = character.level === 1 && character.features.some((feature) => feature.name.toLowerCase() === "expertise");
  if (hasStartingExpertise && character.skillExpertise.length < 2) push(issues, "error", "training-expertise", "Complete starting Expertise", "Choose two proficient skills for Expertise.");
  const hasFightingStyle = character.features.some((feature) => /fighting style/i.test(feature.name));
  const fightingStyle = character.advancementChoices.find((choice) => choice.kind === "fighting-style" && choice.level === 1)?.selections[0];
  if (hasFightingStyle && !fightingStyle) push(issues, "error", "training-fighting-style", "Choose a Fighting Style", "The class grants a Fighting Style at first level.");

  if (selectedBackground?.equipment && !character.startingEquipmentConfirmed) push(issues, "error", "equipment-starting", "Review starting equipment", "Choose a package or starting gold and confirm any GM-approved substitutions.");
  if (!character.inventory.length) push(issues, "warning", "equipment-empty", "No equipment recorded", "Confirm that beginning with an empty inventory is intentional.");
  if (selectedBackground?.featId && !character.feats.some((feat) => feat.id === selectedBackground.featId)) {
    const featName = context.feats.find((feat) => feat.id === selectedBackground.featId)?.name ?? selectedBackground.featId;
    push(issues, "error", "feat-background", "Background feat is missing", `${featName} should be granted by ${selectedBackground.name}.`);
  }
  for (const feat of character.feats) {
    const prerequisiteIssues = featPrerequisiteIssues(feat, character);
    if (prerequisiteIssues.length) push(issues, "warning", `feat-prerequisite-${feat.id}`, `Review ${feat.name} prerequisites`, prerequisiteIssues.join(" "));
  }
  const magicInitiate = character.feats.find((feat) => feat.id === "magic-initiate");
  if (magicInitiate) {
    const allowedLists = spellListsGrantedByFeats([magicInitiate]);
    const choice = character.featSpellcastingChoices.find((entry) => entry.featId === magicInitiate.id);
    const chosenCantrips = choice?.cantripIds.map((id) => context.spells.find((spell) => spell.id === id));
    const chosenLevelOne = choice?.levelOneSpellId ? context.spells.find((spell) => spell.id === choice.levelOneSpellId) : undefined;
    const valid = Boolean(choice
      && allowedLists.includes(choice.spellList)
      && choice.ability && ["intellect", "spirit", "charisma"].includes(choice.ability)
      && choice.cantripIds.length === 2 && new Set(choice.cantripIds).size === 2
      && chosenCantrips?.every((spell) => spell?.level === 0 && spellMatchesLists(spell, [choice.spellList]))
      && chosenLevelOne?.level === 1 && spellMatchesLists(chosenLevelOne, [choice.spellList])
      && [...choice.cantripIds, choice.levelOneSpellId].every((id) => character.spells.some((spell) => spell.id === id && spell.sourceFeatId === magicInitiate.id)));
    if (!valid) push(issues, "error", "feat-magic-initiate", "Complete Magic Initiate", "Choose one spell list, one casting ability, two different cantrips, and one level-1 spell from that same list on the Spells page.");
  }

  for (const classLevel of character.classLevels) {
    const definition = context.classes.find((entry) => entry.name === classLevel.className);
    if (!definition) continue;
    const specializationLevel = Math.min(...(definition.subclasses ?? []).flatMap((subclass) => Object.keys(subclass.levelFeatures).map(Number)).filter(Number.isFinite));
    if (Number.isFinite(specializationLevel) && classLevel.level >= specializationLevel && !classLevel.subclassName) {
      push(issues, "error", `subclass-${classLevel.className}`, `Choose a ${classLevel.className} subclass`, `A specialization is required by ${classLevel.className} level ${specializationLevel}.`);
    }
    const castingAbility = spellcastingAbilityForClass(classLevel.className, classLevel.subclassName ?? "", definition.primaryAbility);
    const requirements = startingSpellRequirementsFor(classLevel.className, classLevel.level);
    const classSpells = character.spells.filter((spell) => spell.className === classLevel.className);
    if (castingAbility && requirements) {
      const cantrips = classSpells.filter((spell) => spell.level === 0).length;
      const learned = classSpells.filter((spell) => spell.level > 0 && !spell.alwaysPrepared).length;
      const prepared = classSpells.filter((spell) => spell.level > 0 && spell.prepared && !spell.alwaysPrepared).length;
      if (cantrips < requirements.cantrips) push(issues, "error", `spells-cantrips-${classLevel.className}`, `Choose ${classLevel.className} cantrips`, `${cantrips} of ${requirements.cantrips} required cantrips are recorded.`);
      if (learned < requirements.learned) push(issues, "error", `spells-learned-${classLevel.className}`, `Choose ${classLevel.className} spells`, `${learned} of ${requirements.learned} required level-1+ spells are recorded.`);
      if (prepared < requirements.prepared) push(issues, "error", `spells-prepared-low-${classLevel.className}`, `Prepare ${classLevel.className} spells`, `${prepared} of ${requirements.prepared} required spells are prepared.`);
      if (cantrips > requirements.cantrips || (classLevel.level === 1 && learned > requirements.learned)) push(issues, classLevel.level === 1 ? "error" : "warning", `spells-extra-${classLevel.className}`, `Review extra ${classLevel.className} spells`, `The starting baseline is ${requirements.cantrips} cantrips and ${requirements.learned} level-1+ spells.`);
      const slots = progressionSpellSlots(classLevel.className, classLevel.subclassName ?? "", classLevel.level) ?? {};
      const maximumSpellLevel = Math.max(0, ...Object.entries(slots).filter(([, maximum]) => maximum > 0).map(([level]) => Number(level)));
      if (classSpells.some((spell) => spell.level > maximumSpellLevel)) push(issues, "error", `spells-level-${classLevel.className}`, `${classLevel.className} spell level is too high`, `Choose only cantrips and spells up to level ${maximumSpellLevel}.`);
    }
    const preparedLimit = preparedSpellLimitFor(classLevel.className, classLevel.subclassName ?? "", classLevel.level);
    if (preparedLimit !== null) {
      const prepared = character.spells.filter((spell) => spell.className === classLevel.className && spell.level > 0 && spell.prepared && !spell.alwaysPrepared).length;
      if (prepared > preparedLimit) push(issues, "error", `spells-prepared-${classLevel.className}`, `Too many ${classLevel.className} spells prepared`, `${prepared} prepared; the current limit is ${preparedLimit}.`);
    }
  }

  if (character.maxHp < 1) push(issues, "error", "vitals-hp", "Set maximum hit points", "Maximum hit points must be at least 1.");
  if (character.currentHp !== character.maxHp) push(issues, "warning", "vitals-current-hp", "Character is not at full hit points", `Current hit points are ${character.currentHp} of ${character.maxHp}.`);

  const profile = context.campaignProfile;
  if (profile) {
    if (character.campaignProfileId && character.campaignProfileId !== profile.id) push(issues, "error", "campaign-profile", "Wrong campaign profile", `This character is linked to a different profile than ${profile.name}.`);
    if (character.level !== profile.startingLevel) push(issues, "error", "campaign-level", "Starting level does not match", `${profile.name} starts at level ${profile.startingLevel}; this character is level ${character.level}.`);
    if (!profile.allowedAbilityMethods.includes(character.abilityScoreMethod)) push(issues, "error", "campaign-ability-method", "Ability method is not allowed", `${character.abilityScoreMethod.replaceAll("-", " ")} is not enabled by ${profile.name}.`);
    if (!profile.allowMulticlass && character.classLevels.length > 1) push(issues, "error", "campaign-multiclass", "Multiclassing is disabled", `${profile.name} only allows single-class characters.`);
    const missingPacks = profile.allowedPackIds.filter((id) => !context.loadedPackIds.includes(id));
    if (missingPacks.length) push(issues, "error", "campaign-packs", "Campaign content is missing", `Import or enable: ${missingPacks.join(", ")}.`);
    const attuned = character.inventory.filter((item) => item.attuned).length;
    if (attuned > profile.attunementLimit) push(issues, "error", "campaign-attunement", "Too many attuned items", `${attuned} items are attuned; ${profile.name} allows ${profile.attunementLimit}.`);
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { ready: errors.length === 0, errors, warnings, checkedAt: new Date().toISOString() };
}
