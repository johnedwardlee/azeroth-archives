const ABILITIES = ["strength", "agility", "stamina", "intellect", "spirit", "charisma"];
const STRING_ARRAY_FIELDS = [
  "skillProficiencies", "skillExpertise", "classSkillChoices", "languages", "toolProficiencies", "armorProficiencies",
  "weaponProficiencies", "weaponMasteries", "conditions", "damageResistances", "damageVulnerabilities", "damageImmunities",
  "conditionImmunities",
];

function record(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, path, allowEmpty = true) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) throw new Error(`${path} must be a${allowEmpty ? "" : " non-empty"} string.`);
}

function finite(value, path, minimum, maximum, integer = true) {
  if (typeof value !== "number" || !Number.isFinite(value) || (integer && !Number.isInteger(value)) || value < minimum || value > maximum) {
    throw new Error(`${path} must be a finite ${integer ? "integer" : "number"} from ${minimum} to ${maximum}.`);
  }
}

function stringArray(value, path) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw new Error(`${path} must be a list of strings.`);
}

function assertCharacter(character) {
  if (!record(character)) throw new Error("Character data must be an object.");
  requiredString(character.id, "Character id", false);
  requiredString(character.name, "Character name", false);
  if (character.schemaVersion !== 6) throw new Error("Character data must be migrated to schema version 6 before it is saved.");

  for (const field of ["playerName", "ancestry", "className", "background", "notes", "createdAt", "updatedAt"]) requiredString(character[field], `Character ${field}`);
  if (character.subclassName !== undefined) requiredString(character.subclassName, "Character subclassName");
  if (character.campaignProfileId !== undefined) requiredString(character.campaignProfileId, "Character campaignProfileId", false);
  if (character.finalizedAt !== undefined) requiredString(character.finalizedAt, "Character finalizedAt", false);
  if (character.reviewImportedAt !== undefined) requiredString(character.reviewImportedAt, "Character reviewImportedAt", false);
  if (character.readOnlyReview !== undefined && typeof character.readOnlyReview !== "boolean") throw new Error("Character readOnlyReview must be a boolean.");
  if (character.portraitDataUrl !== undefined && (typeof character.portraitDataUrl !== "string" || !character.portraitDataUrl.startsWith("data:image/"))) throw new Error("Character portrait must be an image data URL.");

  const numberFields = {
    level: [1, 20], experience: [0, 99_999_999], currentHp: [0, 9_999], maxHp: [1, 9_999], temporaryHp: [0, 9_999], armorClass: [0, 99],
    speed: [0, 999], proficiencyBonus: [2, 6], startingGold: [0, 9_999_999], hitDiceTotal: [1, 20], hitDiceUsed: [0, 20],
    deathSaveSuccesses: [0, 3], deathSaveFailures: [0, 3], exhaustionLevel: [0, 6],
  };
  for (const [field, [minimum, maximum]] of Object.entries(numberFields)) finite(character[field], `Character ${field}`, minimum, maximum);
  if (character.currentHp > character.maxHp) throw new Error("Character currentHp cannot exceed maxHp.");
  if (character.hitDiceUsed > character.hitDiceTotal) throw new Error("Character hitDiceUsed cannot exceed hitDiceTotal.");

  for (const field of ["abilityScoresConfirmed", "startingEquipmentConfirmed", "inspiration"]) if (typeof character[field] !== "boolean") throw new Error(`Character ${field} must be a boolean.`);
  if (!["standard-array", "point-buy", "rolled", "manual"].includes(character.abilityScoreMethod)) throw new Error("Character abilityScoreMethod is invalid.");
  if (!["", "A", "B"].includes(character.startingEquipmentChoice)) throw new Error("Character startingEquipmentChoice is invalid.");
  for (const field of STRING_ARRAY_FIELDS) stringArray(character[field], `Character ${field}`);
  stringArray(character.favoriteActionIds, "Character favoriteActionIds");
  stringArray(character.savingThrowProficiencies, "Character savingThrowProficiencies");
  if (character.savingThrowProficiencies.some((ability) => !ABILITIES.includes(ability))) throw new Error("Character savingThrowProficiencies contains an invalid ability.");

  for (const field of ["abilities", "baseAbilities"]) {
    if (!record(character[field])) throw new Error(`Character ${field} must be an object.`);
    for (const ability of ABILITIES) finite(character[field][ability], `Character ${field}.${ability}`, 1, 30);
  }
  for (const field of ["backgroundAbilityBonuses", "savingThrowBonuses"]) {
    if (!record(character[field])) throw new Error(`Character ${field} must be an object.`);
    for (const [ability, value] of Object.entries(character[field])) {
      if (!ABILITIES.includes(ability)) throw new Error(`Character ${field} contains an invalid ability.`);
      finite(value, `Character ${field}.${ability}`, -99, 99);
    }
  }

  if (!Array.isArray(character.classLevels)) throw new Error("Character classLevels must be a list.");
  const classNames = new Set();
  let totalClassLevel = 0;
  for (const [index, entry] of character.classLevels.entries()) {
    if (!record(entry)) throw new Error(`Character classLevels[${index}] must be an object.`);
    requiredString(entry.className, `Character classLevels[${index}].className`, false);
    if (entry.subclassName !== undefined) requiredString(entry.subclassName, `Character classLevels[${index}].subclassName`);
    finite(entry.level, `Character classLevels[${index}].level`, 1, 20);
    if (classNames.has(entry.className)) throw new Error("Character classLevels must not contain duplicate classes.");
    classNames.add(entry.className);
    totalClassLevel += entry.level;
  }
  if (character.classLevels.length && totalClassLevel !== character.level) throw new Error("Character class levels must add up to the total level.");
  if (character.hitDiceTotal !== character.level) throw new Error("Character hitDiceTotal must equal the total level.");

  for (const field of ["attacks", "features", "feats", "spells", "featSpellcastingChoices", "activeEffects", "companions", "inventory", "resources", "hitDiceByClass", "advancementChoices", "advancementHistory", "journal"]) {
    if (!Array.isArray(character[field])) throw new Error(`Character ${field} must be a list.`);
  }
  if (!Array.isArray(character.recentActions)) throw new Error("Character recentActions must be a list.");
  character.recentActions.forEach((entry, index) => {
    if (!record(entry)) throw new Error(`Character recentActions[${index}] must be an object.`);
    for (const field of ["actionId", "name", "source", "result", "usedAt"]) requiredString(entry[field], `Character recentActions[${index}].${field}`, false);
    if (!["action", "bonus", "reaction", "passive"].includes(entry.timing)) throw new Error(`Character recentActions[${index}].timing is invalid.`);
  });
  character.inventory.forEach((item, index) => {
    if (!record(item)) throw new Error(`Character inventory[${index}] must be an object.`);
    requiredString(item.id, `Character inventory[${index}].id`, false); requiredString(item.name, `Character inventory[${index}].name`, false); requiredString(item.notes, `Character inventory[${index}].notes`);
    finite(item.quantity, `Character inventory[${index}].quantity`, 0, 999_999);
    if (typeof item.equipped !== "boolean") throw new Error(`Character inventory[${index}].equipped must be a boolean.`);
  });
  const inventoryIds = new Set(character.inventory.map((item) => item.id));
  character.attacks.forEach((attack, index) => {
    if (!record(attack)) throw new Error(`Character attacks[${index}] must be an object.`);
    requiredString(attack.id, `Character attacks[${index}].id`, false); requiredString(attack.name, `Character attacks[${index}].name`, false);
    if (attack.inventoryItemId !== undefined) { requiredString(attack.inventoryItemId, `Character attacks[${index}].inventoryItemId`, false); if (!inventoryIds.has(attack.inventoryItemId)) throw new Error(`Character attacks[${index}] references an inventory item the character does not have.`); }
    if (!ABILITIES.includes(attack.ability)) throw new Error(`Character attacks[${index}].ability is invalid.`);
    if (typeof attack.proficient !== "boolean") throw new Error(`Character attacks[${index}].proficient must be a boolean.`);
    for (const field of ["bonus", "damageBonus"]) finite(attack[field], `Character attacks[${index}].${field}`, -99, 99);
    for (const field of ["damage", "damageType", "notes"]) requiredString(attack[field], `Character attacks[${index}].${field}`);
  });
  character.features.forEach((feature, index) => { if (!record(feature)) throw new Error(`Character features[${index}] must be an object.`); requiredString(feature.name, `Character features[${index}].name`, false); requiredString(feature.description, `Character features[${index}].description`); });
  character.feats.forEach((feat, index) => { if (!record(feat)) throw new Error(`Character feats[${index}] must be an object.`); for (const field of ["id", "name", "category", "description"]) requiredString(feat[field], `Character feats[${index}].${field}`, field !== "id" && field !== "name"); });
  character.spells.forEach((spell, index) => {
    if (!record(spell)) throw new Error(`Character spells[${index}] must be an object.`);
    requiredString(spell.id, `Character spells[${index}].id`, false); requiredString(spell.name, `Character spells[${index}].name`, false);
    finite(spell.level, `Character spells[${index}].level`, 0, 9); stringArray(spell.classes, `Character spells[${index}].classes`);
    for (const field of ["school", "castingTime", "range", "components", "duration", "description"]) requiredString(spell[field], `Character spells[${index}].${field}`);
    if (spell.ritual !== undefined && typeof spell.ritual !== "boolean") throw new Error(`Character spells[${index}].ritual must be a boolean.`);
    if (typeof spell.prepared !== "boolean") throw new Error(`Character spells[${index}].prepared must be a boolean.`);
    if (spell.className !== undefined) { requiredString(spell.className, `Character spells[${index}].className`, false); if (!classNames.has(spell.className)) throw new Error(`Character spells[${index}] belongs to a class the character does not have.`); }
    if (spell.sourceFeatId !== undefined) requiredString(spell.sourceFeatId, `Character spells[${index}].sourceFeatId`, false);
    if (spell.castingAbility !== undefined && !ABILITIES.includes(spell.castingAbility)) throw new Error(`Character spells[${index}].castingAbility is invalid.`);
  });
  character.featSpellcastingChoices.forEach((choice, index) => {
    if (!record(choice)) throw new Error(`Character featSpellcastingChoices[${index}] must be an object.`);
    requiredString(choice.featId, `Character featSpellcastingChoices[${index}].featId`, false);
    requiredString(choice.spellList, `Character featSpellcastingChoices[${index}].spellList`);
    if (choice.ability !== undefined && !ABILITIES.includes(choice.ability)) throw new Error(`Character featSpellcastingChoices[${index}].ability is invalid.`);
    stringArray(choice.cantripIds, `Character featSpellcastingChoices[${index}].cantripIds`);
    if (choice.levelOneSpellId !== undefined) requiredString(choice.levelOneSpellId, `Character featSpellcastingChoices[${index}].levelOneSpellId`, false);
    if (typeof choice.freeCastUsed !== "boolean") throw new Error(`Character featSpellcastingChoices[${index}].freeCastUsed must be a boolean.`);
    if (choice.freeCastUsedSpellIds !== undefined) stringArray(choice.freeCastUsedSpellIds, `Character featSpellcastingChoices[${index}].freeCastUsedSpellIds`);
  });

  if (!record(character.spellSlots)) throw new Error("Character spellSlots must be an object.");
  for (const [level, slot] of Object.entries(character.spellSlots)) {
    if (!/^[1-9]$/.test(level) || !record(slot)) throw new Error("Character spellSlots contains an invalid slot level.");
    finite(slot.maximum, `Character spellSlots.${level}.maximum`, 0, 20); finite(slot.used, `Character spellSlots.${level}.used`, 0, slot.maximum);
  }
  if (!record(character.currency)) throw new Error("Character currency must be an object.");
  for (const coin of ["copper", "silver", "gold"]) finite(character.currency[coin], `Character currency.${coin}`, 0, 999_999_999);
  character.resources.forEach((resource, index) => { if (!record(resource)) throw new Error(`Character resources[${index}] must be an object.`); requiredString(resource.id, `Character resources[${index}].id`, false); requiredString(resource.name, `Character resources[${index}].name`, false); finite(resource.maximum, `Character resources[${index}].maximum`, 0, 999); finite(resource.current, `Character resources[${index}].current`, 0, resource.maximum); if (!["short", "short-one", "long", "manual"].includes(resource.recovery)) throw new Error(`Character resources[${index}].recovery is invalid.`); });
  character.hitDiceByClass.forEach((pool, index) => { if (!record(pool)) throw new Error(`Character hitDiceByClass[${index}] must be an object.`); requiredString(pool.className, `Character hitDiceByClass[${index}].className`, false); finite(pool.die, `Character hitDiceByClass[${index}].die`, 0, 20); finite(pool.total, `Character hitDiceByClass[${index}].total`, 1, 20); finite(pool.used, `Character hitDiceByClass[${index}].used`, 0, pool.total); });
  if (character.classLevels.length && character.hitDiceByClass.reduce((total, pool) => total + pool.total, 0) !== character.level) throw new Error("Character hit-dice pools must add up to the total level.");
  return character;
}

module.exports = { assertCharacter };
