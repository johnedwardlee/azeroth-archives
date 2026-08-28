import {
  abilityModifier,
  type AbilityKey,
  type AdvancementChoiceKind,
  type ActiveEffect,
  type ActionTiming,
  type CharacterAttack,
  type CharacterClassLevel,
  type CharacterData,
  type CharacterResource,
  type EncumbranceRule,
  type EquipmentDefinition,
  type FeatDefinition,
  type InventoryItem,
  type RulesFeature,
  type SpellDefinition,
  type SpellSlotState,
} from "./types";

export type EncumbranceLevel = "unencumbered" | "encumbered" | "heavily-encumbered" | "over-capacity";
export type RollKind = "ability" | "attack" | "save";
export type RollMode = "normal" | "advantage" | "disadvantage";

const abilityKeys: AbilityKey[] = ["strength", "agility", "stamina", "intellect", "spirit", "charisma"];
const incapacitatingConditions = new Set(["incapacitated", "paralyzed", "petrified", "stunned", "unconscious"]);

export const DAMAGE_TYPES = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];
export const METAMAGIC_OPTIONS = ["Careful Spell", "Distant Spell", "Empowered Spell", "Extended Spell", "Heightened Spell", "Quickened Spell", "Seeking Spell", "Subtle Spell", "Transmuted Spell", "Twinned Spell"];
export const STANDARD_CONDITIONS = ["Blinded", "Charmed", "Deafened", "Exhaustion", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];

export function startingHitPoints(hitDie: number, staminaScore: number) {
  return Math.max(1, hitDie + abilityModifier(staminaScore));
}

export function featAbilityIncrease(feat?: FeatDefinition) {
  if (!feat) return null;
  const sentence = feat.description.match(/Ability Score Increase:\s*([^.]*)\./i)?.[1] ?? "";
  if (!sentence) return null;
  const maximum = Number(sentence.match(/maximum of\s+(\d+)/i)?.[1] ?? 20);
  const options = /one ability score of your choice/i.test(sentence)
    ? abilityKeys
    : abilityKeys.filter((ability) => new RegExp(`\\b${ability}\\b`, "i").test(sentence));
  return options.length ? { options, maximum: maximum === 30 ? 30 : 20 } : null;
}

function normalizedSpellListName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(?:rules?|spell)\s+list\b/g, "")
    .trim();
  const aliases: Record<string, string> = {
    cleric: "priest",
    druid: "nature",
    fighter: "warrior",
    ranger: "hunter",
    wizard: "mage",
  };
  return aliases[normalized] ?? normalized;
}

export function spellListsGrantedByFeats(feats: Pick<FeatDefinition, "description">[]) {
  const lists = feats.flatMap((feat) => Array.from(feat.description.matchAll(/from (?:the )?([^.;]+?) spell list\b/gi), (match) => match[1])
    .flatMap((list) => list
      .replace(/,\s*(?:or|and)\s+/gi, ",")
      .replace(/\s+(?:or|and)\s+/gi, ",")
      .split(",")
      .map((name) => name.replace(/^(?:the|or|and)\s+/i, "").trim())
      .filter(Boolean)));
  return [...new Set(lists)];
}

export function spellMatchesLists(spell: Pick<SpellDefinition, "classes">, listNames: Iterable<string>) {
  const allowed = new Set(Array.from(listNames, normalizedSpellListName));
  return spell.classes.some((className) => allowed.has(normalizedSpellListName(className)));
}

export function startingSpellRequirementsFor(className: string, level: number) {
  const normalizedClass = className.trim().toLowerCase();
  const safeLevel = Math.max(1, Math.min(20, level));
  const cantripProgression: Record<string, [number, number, number]> = {
    bard: [2, 3, 4],
    priest: [3, 4, 5],
    sorcerer: [4, 5, 6],
    mage: [3, 4, 5],
  };
  const progression = cantripProgression[normalizedClass];
  const cantrips = progression ? (safeLevel >= 10 ? progression[2] : safeLevel >= 4 ? progression[1] : progression[0]) : 0;
  const prepared = preparedSpellLimitFor(className, "", safeLevel);
  if (prepared === null) return null;
  return {
    cantrips,
    learned: normalizedClass === "mage" ? 6 + ((safeLevel - 1) * 2) : prepared,
    prepared,
  };
}

export function isIncapacitated(character: Pick<CharacterData, "conditions">) {
  return character.conditions.some((condition) => incapacitatingConditions.has(condition.trim().toLowerCase()));
}

export function syncEffectConditions(currentConditions: string[], previousEffects: ActiveEffect[], nextEffects: ActiveEffect[]) {
  const nextEffectConditions = new Map<string, string>();
  for (const effect of nextEffects) {
    const condition = effect.condition?.trim();
    if (condition) nextEffectConditions.set(condition.toLowerCase(), condition);
  }
  const removedEffectConditions = new Set(previousEffects.flatMap((effect) => {
    const condition = effect.condition?.trim();
    return condition && !nextEffectConditions.has(condition.toLowerCase()) ? [condition.toLowerCase()] : [];
  }));
  const conditions = currentConditions.filter((condition) => !removedEffectConditions.has(condition.trim().toLowerCase()));
  for (const [normalized, condition] of nextEffectConditions) {
    if (!conditions.some((entry) => entry.trim().toLowerCase() === normalized)) conditions.push(condition);
  }
  return conditions;
}

export type AdvancementPrompt = {
  id: string;
  featureId?: string;
  featureName: string;
  kind: AdvancementChoiceKind;
  count: number;
  label: string;
};

export type GeneratedAction = {
  id: string;
  name: string;
  timing: ActionTiming;
  purpose: "attack" | "spell" | "healing" | "defense" | "control" | "item" | "utility" | "companion";
  source: string;
  description: string;
  resourceId?: string;
  resourceCost?: number;
  spellId?: string;
  inventoryId?: string;
  attackId?: string;
  ammunitionItemId?: string;
};

function actionPurpose(name: string, description: string): GeneratedAction["purpose"] {
  const text = `${name} ${description}`;
  if (/heal|hit points?|temporary hit points?|restore/i.test(text)) return "healing";
  if (/attack roll|weapon attack|spell attack|\bdamage\b/i.test(text)) return "attack";
  if (/armor class|resistance|immunity|disadvantage on attacks|dodge|disengage/i.test(text)) return "defense";
  if (/charmed|frightened|grappled|incapacitated|paralyzed|prone|restrained|stunned|condition|control/i.test(text)) return "control";
  return "utility";
}

type ClassTraining = {
  skillChoices: number;
  skillOptions: string[];
  armor: string[];
  weapons: string[];
  masteryChoices: number;
};

const classTraining: Record<string, ClassTraining> = {
  barbarian: { skillChoices: 2, skillOptions: ["Animal Handling", "Athletics", "Intimidation", "Nature", "Perception", "Survival"], armor: ["Light Armor", "Medium Armor", "Shield"], weapons: ["Simple Weapons", "Martial Weapons"], masteryChoices: 2 },
  bard: { skillChoices: 3, skillOptions: [], armor: ["Light Armor"], weapons: ["Simple Weapons"], masteryChoices: 0 },
  priest: { skillChoices: 2, skillOptions: ["History", "Insight", "Medicine", "Persuasion", "Religion"], armor: ["Light Armor", "Medium Armor", "Shield"], weapons: ["Simple Weapons"], masteryChoices: 0 },
  warrior: { skillChoices: 2, skillOptions: ["Acrobatics", "Animal Handling", "Athletics", "History", "Insight", "Intimidation", "Perception", "Persuasion", "Survival"], armor: ["Light Armor", "Medium Armor", "Heavy Armor", "Shield"], weapons: ["Simple Weapons", "Martial Weapons"], masteryChoices: 3 },
  monk: { skillChoices: 2, skillOptions: ["Acrobatics", "Athletics", "History", "Insight", "Religion", "Stealth"], armor: [], weapons: ["Simple Weapons", "Martial Melee Weapons (Light)"], masteryChoices: 2 },
  paladin: { skillChoices: 2, skillOptions: ["Athletics", "Insight", "Intimidation", "Medicine", "Persuasion", "Religion"], armor: ["Light Armor", "Medium Armor", "Heavy Armor", "Shield"], weapons: ["Simple Weapons", "Martial Weapons"], masteryChoices: 2 },
  hunter: { skillChoices: 3, skillOptions: ["Animal Handling", "Athletics", "Insight", "Investigation", "Nature", "Perception", "Stealth", "Survival"], armor: ["Light Armor", "Medium Armor", "Shield"], weapons: ["Simple Weapons", "Martial Weapons"], masteryChoices: 2 },
  rogue: { skillChoices: 4, skillOptions: ["Acrobatics", "Athletics", "Deception", "Insight", "Intimidation", "Investigation", "Perception", "Persuasion", "Sleight of Hand", "Stealth"], armor: ["Light Armor"], weapons: ["Simple Weapons", "Martial Weapons (Finesse or Light)"], masteryChoices: 2 },
  sorcerer: { skillChoices: 2, skillOptions: ["Arcana", "Deception", "Insight", "Intimidation", "Persuasion", "Religion"], armor: [], weapons: ["Simple Weapons"], masteryChoices: 0 },
  mage: { skillChoices: 2, skillOptions: ["Arcana", "History", "Insight", "Investigation", "Medicine", "Nature", "Religion"], armor: [], weapons: ["Simple Weapons"], masteryChoices: 0 },
};

export function classTrainingFor(className: string): ClassTraining {
  return classTraining[className.trim().toLowerCase()] ?? { skillChoices: 2, skillOptions: [], armor: [], weapons: [], masteryChoices: 0 };
}

export function featPrerequisiteIssues(feat: FeatDefinition, character: CharacterData) {
  const prerequisite = feat.prerequisite?.trim();
  if (!prerequisite) return [];
  const issues: string[] = [];
  const level = prerequisite.match(/level\s*(\d+)\+?/i);
  if (level && character.level < Number(level[1])) issues.push(`Requires level ${level[1]}.`);
  for (const [ability, label] of Object.entries({ strength: "Strength", agility: "Agility", stamina: "Stamina", intellect: "Intellect", spirit: "Spirit", charisma: "Charisma" }) as Array<[AbilityKey, string]>) {
    const match = prerequisite.match(new RegExp(`${label}\\s*(?:score\\s*)?(\\d+)\\+?`, "i"));
    if (match && character.abilities[ability] < Number(match[1])) issues.push(`Requires ${label} ${match[1]}.`);
  }
  if (/spellcasting|ability to cast/i.test(prerequisite) && !character.classLevels.some((entry) => spellcastingAbilityForClass(entry.className, entry.subclassName ?? ""))) issues.push("Requires spellcasting.");
  if (/martial weapon/i.test(prerequisite) && !character.weaponProficiencies.some((entry) => /martial/i.test(entry))) issues.push("Requires Martial Weapon proficiency.");
  return issues;
}

const fullCasterSlots = [
  [], [2], [3], [4, 2], [4, 3], [4, 3, 2], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 3, 1],
  [4, 3, 3, 3, 2], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1], [4, 3, 3, 3, 2, 1, 1], [4, 3, 3, 3, 2, 1, 1],
  [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 2, 1, 1, 1, 1],
  [4, 3, 3, 3, 3, 1, 1, 1, 1], [4, 3, 3, 3, 3, 2, 1, 1, 1], [4, 3, 3, 3, 3, 2, 2, 1, 1],
];

const halfCasterSlots = [
  [], [2], [2], [3], [3], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3],
  [4, 3, 3, 1], [4, 3, 3, 1], [4, 3, 3, 2], [4, 3, 3, 2], [4, 3, 3, 3, 1], [4, 3, 3, 3, 1], [4, 3, 3, 3, 2], [4, 3, 3, 3, 2],
];

const thirdCasterSlots = [
  [], [], [], [2], [3], [3], [3], [4, 2], [4, 2], [4, 2], [4, 3], [4, 3], [4, 3], [4, 3, 2], [4, 3, 2], [4, 3, 2], [4, 3, 3], [4, 3, 3], [4, 3, 3], [4, 3, 3, 1], [4, 3, 3, 1],
];

const standardPrepared = [0, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const sorcererPrepared = [0, 2, 4, 6, 7, 9, 10, 11, 12, 14, 15, 16, 16, 17, 17, 18, 18, 19, 20, 21, 22];
const halfCasterPrepared = [0, 2, 3, 4, 5, 6, 6, 7, 7, 9, 9, 10, 10, 11, 11, 12, 12, 14, 14, 15, 15];

const spellcastingAbilities: Record<string, AbilityKey> = {
  bard: "charisma",
  priest: "spirit",
  paladin: "charisma",
  hunter: "spirit",
  sorcerer: "charisma",
  mage: "intellect",
};

const zeroSpeedConditions = new Set(["Grappled", "Paralyzed", "Petrified", "Restrained", "Stunned", "Unconscious"]);

export function listedWeightInPounds(value?: string) {
  if (!value) return null;
  const normalized = value
    .replace(/,/g, "")
    .replace(/½/g, " 1/2")
    .replace(/¼/g, " 1/4")
    .replace(/¾/g, " 3/4");
  const mixedNumber = normalized.match(/(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)/);
  if (mixedNumber) {
    const denominator = Number(mixedNumber[3]);
    return denominator ? Number(mixedNumber[1]) + Number(mixedNumber[2]) / denominator : null;
  }
  const fraction = normalized.match(/(\d+)\/(\d+)/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    return denominator ? Number(fraction[1]) / denominator : null;
  }
  const number = normalized.match(/\d+(?:\.\d+)?/);
  return number ? Number(number[0]) : null;
}

export function formatPounds(value: number) {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
}

export function calculateEncumbrance(inventory: InventoryItem[], strengthScore: number, rule: EncumbranceRule = "standard") {
  const strength = Math.max(1, Math.min(30, Number.isFinite(strengthScore) ? strengthScore : 1));
  const totalWeight = inventory.reduce((total, item) => total + (listedWeightInPounds(item.weight) ?? 0) * item.quantity, 0);
  const unlistedWeightItems = inventory.reduce((total, item) => total + (listedWeightInPounds(item.weight) === null ? item.quantity : 0), 0);
  const encumberedAt = strength * 5;
  const heavilyEncumberedAt = strength * 10;
  const carryingCapacity = strength * 15;
  let level: EncumbranceLevel = "unencumbered";
  let label = "Unencumbered";
  let penalty = "No encumbrance penalties.";
  let speedPenalty = 0;

  if (rule === "none") {
    label = "Not enforced";
    penalty = "This campaign tracks listed weight without enforcing encumbrance penalties.";
  } else if (totalWeight > carryingCapacity) {
    level = "over-capacity";
    label = "Over capacity";
    penalty = `Cannot normally carry this load. Remove at least ${formatPounds(totalWeight - carryingCapacity)} lb.`;
  } else if (rule === "variant" && totalWeight > heavilyEncumberedAt) {
    level = "heavily-encumbered";
    label = "Heavily encumbered";
    penalty = "Speed −20 ft.; disadvantage on Strength, Agility, and Stamina ability checks, attack rolls, and saving throws.";
    speedPenalty = 20;
  } else if (rule === "variant" && totalWeight > encumberedAt) {
    level = "encumbered";
    label = "Encumbered";
    penalty = "Speed −10 ft.";
    speedPenalty = 10;
  }

  const loadPercent = carryingCapacity ? Math.min(100, totalWeight / carryingCapacity * 100) : 0;
  return { strength, totalWeight, unlistedWeightItems, encumberedAt, heavilyEncumberedAt, carryingCapacity, loadPercent, level, label, penalty, speedPenalty, rule };
}

function armorValue(item: EquipmentDefinition, agilityModifier: number) {
  const acText = item.description?.match(/Armor Class \(Ac\):\s*([^;.]+)/i)?.[1] ?? "";
  const base = Number(acText.match(/\d+/)?.[0]);
  if (!base) return null;
  if (/Light Armor/i.test(item.category)) return base + agilityModifier;
  if (/Medium Armor/i.test(item.category)) return base + Math.min(2, agilityModifier);
  if (/Heavy Armor/i.test(item.category)) return base;
  return null;
}

export function calculateArmorClass(character: CharacterData, catalog: EquipmentDefinition[]) {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const equipped = character.inventory
    .filter((item) => item.equipped && item.contentId)
    .map((item) => catalogById.get(item.contentId!))
    .filter((item): item is EquipmentDefinition => Boolean(item));
  const agility = abilityModifier(character.abilities.agility);
  const armors = equipped
    .map((item) => ({ item, value: armorValue(item, agility) }))
    .filter((entry): entry is { item: EquipmentDefinition; value: number } => entry.value !== null);
  const bestArmor = armors.sort((left, right) => right.value - left.value)[0];
  const shield = equipped.find((item) => /shield/i.test(item.category));
  const shieldBonus = shield ? Number(shield.description?.match(/Armor Class \(Ac\):\s*\+(\d+)/i)?.[1] ?? 2) : 0;
  return {
    value: (bestArmor?.value ?? character.armorClass) + shieldBonus,
    automatic: Boolean(bestArmor || shield),
    source: [bestArmor?.item.name, shield?.name].filter(Boolean).join(" + ") || "Manual defense",
  };
}

export function equippedArmorEffects(character: CharacterData, catalog: EquipmentDefinition[]) {
  const catalogById = new Map(catalog.map((item) => [item.id, item]));
  const equippedArmor = character.inventory
    .filter((item) => item.equipped && item.contentId)
    .map((item) => catalogById.get(item.contentId!))
    .filter((item): item is EquipmentDefinition => Boolean(item && /armor/i.test(item.category)));
  const strengthRequirements = equippedArmor.map((item) => ({
    item,
    required: Number(item.description?.match(/Strength:\s*(?:Str(?:ength)?\s*)?(\d+)/i)?.[1] ?? 0),
  }));
  const unmetStrength = strengthRequirements.find(({ required }) => required > character.abilities.strength);
  const stealthDisadvantage = equippedArmor.some((item) => /Stealth:\s*Disadvantage/i.test(item.description ?? ""));
  return {
    speedPenalty: unmetStrength ? 10 : 0,
    strengthRequirement: unmetStrength?.required ?? 0,
    strengthArmorName: unmetStrength?.item.name ?? "",
    stealthDisadvantage,
  };
}

export function calculateEffectiveSpeed(character: CharacterData, encumbrance = calculateEncumbrance(character.inventory, character.abilities.strength), catalog: EquipmentDefinition[] = []) {
  const exhaustionPenalty = Math.max(0, Math.min(6, character.exhaustionLevel || 0)) * 5;
  const armorEffects = equippedArmorEffects(character, catalog);
  const stoppedBy = character.conditions.find((condition) => zeroSpeedConditions.has(condition));
  const overCapacity = encumbrance.level === "over-capacity";
  const value = stoppedBy || overCapacity ? 0 : Math.max(0, character.speed - encumbrance.speedPenalty - exhaustionPenalty - armorEffects.speedPenalty);
  const effects = [
    encumbrance.speedPenalty ? `Encumbrance −${encumbrance.speedPenalty} ft.` : "",
    exhaustionPenalty ? `Exhaustion −${exhaustionPenalty} ft.` : "",
    armorEffects.speedPenalty ? `${armorEffects.strengthArmorName} requires Strength ${armorEffects.strengthRequirement}: −10 ft.` : "",
    stoppedBy ? `${stoppedBy}: Speed 0` : "",
    overCapacity ? "Over capacity: Speed 0" : "",
  ].filter(Boolean);
  return { value, effects };
}

export function spellcastingAbilityForClass(className: string, subclassName = "", fallback?: AbilityKey) {
  const normalizedClass = className.trim().toLowerCase();
  const normalizedSubclass = subclassName.trim().toLowerCase();
  if (normalizedClass === "warrior" && normalizedSubclass.includes("eldritch knight")) return "intellect";
  if (normalizedClass === "rogue" && normalizedSubclass.includes("arcane trickster")) return "intellect";
  if (["barbarian", "warrior", "monk", "rogue"].includes(normalizedClass)) return null;
  return spellcastingAbilities[normalizedClass] ?? fallback ?? null;
}

export function progressionSpellSlots(className: string, subclassName: string, level: number) {
  const normalizedClass = className.trim().toLowerCase();
  const normalizedSubclass = subclassName.trim().toLowerCase();
  const safeLevel = Math.max(1, Math.min(20, level));
  const progression = ["bard", "priest", "sorcerer", "mage"].includes(normalizedClass)
    ? fullCasterSlots
    : ["paladin", "hunter"].includes(normalizedClass)
      ? halfCasterSlots
      : (normalizedClass === "warrior" && normalizedSubclass.includes("eldritch knight")) || (normalizedClass === "rogue" && normalizedSubclass.includes("arcane trickster"))
        ? thirdCasterSlots
        : null;
  if (!progression) return null;
  return Object.fromEntries((progression[safeLevel] ?? []).map((maximum, index) => [String(index + 1), maximum]));
}

export function syncProgressionSpellSlots(current: Record<string, SpellSlotState>, className: string, subclassName: string, level: number) {
  const progression = progressionSpellSlots(className, subclassName, level);
  if (!progression) return null;
  return Object.fromEntries(Object.entries(progression).map(([slotLevel, maximum]) => [slotLevel, {
    maximum,
    used: Math.min(maximum, current[slotLevel]?.used ?? 0),
  }]));
}

function casterLevelFor(entry: CharacterClassLevel) {
  const className = entry.className.trim().toLowerCase();
  const subclassName = (entry.subclassName ?? "").trim().toLowerCase();
  if (["bard", "priest", "sorcerer", "mage"].includes(className)) return entry.level;
  if (["paladin", "hunter"].includes(className)) return Math.ceil(entry.level / 2);
  if ((className === "warrior" && subclassName.includes("eldritch knight")) || (className === "rogue" && subclassName.includes("arcane trickster"))) {
    return Math.floor(entry.level / 3);
  }
  return 0;
}

export function multiclassSpellSlots(classLevels: CharacterClassLevel[]) {
  const casterLevel = Math.max(0, Math.min(20, classLevels.reduce((total, entry) => total + casterLevelFor(entry), 0)));
  if (!casterLevel) return null;
  return Object.fromEntries((fullCasterSlots[casterLevel] ?? []).map((maximum, index) => [String(index + 1), maximum]));
}

export function syncMulticlassSpellSlots(current: Record<string, SpellSlotState>, classLevels: CharacterClassLevel[]) {
  if (classLevels.length <= 1) {
    const entry = classLevels[0];
    return entry ? syncProgressionSpellSlots(current, entry.className, entry.subclassName ?? "", entry.level) : null;
  }
  const progression = multiclassSpellSlots(classLevels);
  if (!progression) return null;
  return Object.fromEntries(Object.entries(progression).map(([slotLevel, maximum]) => [slotLevel, {
    maximum,
    used: Math.min(maximum, current[slotLevel]?.used ?? 0),
  }]));
}

export function preparedSpellLimitFor(className: string, subclassName: string, level: number) {
  const normalizedClass = className.trim().toLowerCase();
  const normalizedSubclass = subclassName.trim().toLowerCase();
  const safeLevel = Math.max(1, Math.min(20, level));
  if (["bard", "priest", "mage"].includes(normalizedClass)) return standardPrepared[safeLevel];
  if (normalizedClass === "sorcerer") return sorcererPrepared[safeLevel];
  if (["paladin", "hunter"].includes(normalizedClass)) return halfCasterPrepared[safeLevel];
  if ((normalizedClass === "warrior" && normalizedSubclass.includes("eldritch knight")) || (normalizedClass === "rogue" && normalizedSubclass.includes("arcane trickster"))) {
    return Math.max(3, Math.ceil(safeLevel / 3) + 2);
  }
  return null;
}

export function preparedSpellLimitForClasses(classLevels: CharacterClassLevel[]) {
  const limits = classLevels
    .map((entry) => preparedSpellLimitFor(entry.className, entry.subclassName ?? "", entry.level))
    .filter((value): value is number => value !== null);
  return limits.length ? limits.reduce((total, value) => total + value, 0) : null;
}

function writtenCount(text: string, fallback = 1) {
  const match = text.match(/\b(one|two|three|four|five|six|\d+)\b/i)?.[1]?.toLowerCase();
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return match ? ((words[match] ?? Number(match)) || fallback) : fallback;
}

export function advancementPromptsForFeatures(features: RulesFeature[], className: string): AdvancementPrompt[] {
  const training = classTrainingFor(className);
  return features.flatMap<AdvancementPrompt>((feature): AdvancementPrompt[] => {
    const name = feature.name.toLowerCase();
    const description = feature.description;
    const base = { featureId: feature.id, featureName: feature.name };
    if (name.includes("fighting style")) return [{ ...base, id: `${feature.id ?? feature.name}-fighting-style`, kind: "fighting-style" as const, count: 1, label: "Fighting Style feat" }];
    if (name === "weapon mastery") return [{ ...base, id: `${feature.id ?? feature.name}-weapon-mastery`, kind: "weapon-mastery" as const, count: Math.max(1, training.masteryChoices), label: "Mastered weapon" }];
    if (name === "expertise") return [{ ...base, id: `${feature.id ?? feature.name}-expertise`, kind: "expertise" as const, count: /\bone\b/i.test(description) ? 1 : 2, label: "Expertise skill" }];
    if (name === "metamagic") return [{ ...base, id: `${feature.id ?? feature.name}-metamagic`, kind: "metamagic" as const, count: 2, label: "Metamagic option" }];
    const learned = description.match(/\blearn\s+(one|two|three|four|five|six|\d+)\s+(?:\w+\s+)?(cantrips|spells)\b/i);
    if (learned) return [{ ...base, id: `${feature.id ?? feature.name}-spells`, kind: "spell" as const, count: writtenCount(learned[1]), label: learned[2].toLowerCase() === "cantrips" ? "Cantrip" : "Spell" }];
    if (/proficiency (?:with|in).+skill.+choice|skill(?:s)? of your choice/i.test(description)) {
      const count = /three skills/i.test(description) ? 3 : /two skills/i.test(description) ? 2 : 1;
      return [{ ...base, id: `${feature.id ?? feature.name}-skill`, kind: "skill" as const, count, label: "Skill proficiency" }];
    }
    return [];
  });
}

export function equipmentRequiresAttunement(item: EquipmentDefinition) {
  return /requires attunement|attunement required/i.test(item.description ?? "");
}

export function equipmentAttunementRequirement(item: EquipmentDefinition) {
  return item.description?.match(/requires attunement(?: by (?:a|an) )?([^.;)]+)/i)?.[1]?.trim() ?? "";
}

export function defaultEquipmentSlot(item?: EquipmentDefinition): InventoryItem["equipmentSlot"] {
  if (!item) return "worn";
  if (/armor/i.test(item.category)) return "armor";
  if (/shield/i.test(item.category)) return "off-hand";
  if (item.damage && item.properties?.some((property) => /two-handed/i.test(property))) return "two-hands";
  if (item.damage) return "main-hand";
  return "worn";
}

export function isEquipmentProficient(character: CharacterData, item: EquipmentDefinition) {
  const category = item.category.toLowerCase();
  if (/light armor|medium armor|heavy armor|shield/.test(category)) {
    return character.armorProficiencies.some((entry) => entry.toLowerCase() === item.category.toLowerCase());
  }
  if (!item.damage) return true;
  if (category.includes("simple")) return character.weaponProficiencies.some((entry) => entry.toLowerCase().includes("simple"));
  if (category.includes("martial")) {
    if (character.weaponProficiencies.some((entry) => entry.toLowerCase() === "martial weapons")) return true;
    const properties = (item.properties ?? []).join(" ").toLowerCase();
    if (character.weaponProficiencies.some((entry) => entry.toLowerCase().includes("finesse or light"))) return /finesse|light/.test(properties);
    if (character.weaponProficiencies.some((entry) => entry.toLowerCase().includes("martial melee weapons (light)"))) return category.includes("melee") && /light/.test(properties);
    return false;
  }
  return character.weaponProficiencies.some((entry) => category.includes(entry.toLowerCase().replace(/ weapons?$/, "")));
}

export function equipmentRuleWarnings(character: CharacterData, item: InventoryItem, catalog: EquipmentDefinition[]) {
  const definition = item.contentId ? catalog.find((entry) => entry.id === item.contentId) : undefined;
  const warnings: string[] = [];
  if (!item.equipped) return warnings;
  if (definition && !isEquipmentProficient(character, definition)) warnings.push(`Not proficient with ${definition.category}.`);
  if (definition && equipmentRequiresAttunement(definition) && !item.attuned) warnings.push("Requires attunement before use.");
  const attunementRequirement = definition ? equipmentAttunementRequirement(definition) : "";
  if (attunementRequirement && !attunementRequirement.toLowerCase().includes(character.className.toLowerCase())) warnings.push(`Attunement prerequisite: ${attunementRequirement}; verify eligibility.`);
  const slot = item.equipmentSlot ?? defaultEquipmentSlot(definition);
  const otherEquipped = character.inventory.filter((entry) => entry.id !== item.id && entry.equipped);
  if (["main-hand", "off-hand", "armor"].includes(slot ?? "") && otherEquipped.some((entry) => (entry.equipmentSlot ?? defaultEquipmentSlot(entry.contentId ? catalog.find((definition) => definition.id === entry.contentId) : undefined)) === slot)) warnings.push(`${slot?.replace("-", " ")} is already occupied.`);
  if (slot === "two-hands" && otherEquipped.some((entry) => ["main-hand", "off-hand", "two-hands"].includes(entry.equipmentSlot ?? defaultEquipmentSlot(entry.contentId ? catalog.find((definition) => definition.id === entry.contentId) : undefined) ?? ""))) warnings.push("Two-handed use conflicts with another held item.");
  if (["main-hand", "off-hand"].includes(slot ?? "") && otherEquipped.some((entry) => (entry.equipmentSlot ?? defaultEquipmentSlot(entry.contentId ? catalog.find((definition) => definition.id === entry.contentId) : undefined)) === "two-hands")) warnings.push("A two-handed item is already equipped.");
  return warnings;
}

export function hasUnproficientArmor(character: CharacterData, catalog: EquipmentDefinition[]) {
  return character.inventory.some((item) => {
    const definition = item.equipped && item.contentId ? catalog.find((entry) => entry.id === item.contentId) : undefined;
    return Boolean(definition && /armor|shield/i.test(definition.category) && !isEquipmentProficient(character, definition));
  });
}

function actionTiming(text: string): GeneratedAction["timing"] {
  if (/bonus action/i.test(text)) return "bonus";
  if (/\breaction\b/i.test(text)) return "reaction";
  if (/as an? (?:magic |attack )?action|take the (?:magic |attack )?action/i.test(text)) return "action";
  return "passive";
}

export function generatedCharacterActions(character: CharacterData, catalog: EquipmentDefinition[]): GeneratedAction[] {
  const featureActions = [...character.features, ...character.feats].map((feature, index) => {
    const resource = character.resources.find((entry) => feature.description.toLowerCase().includes(entry.name.toLowerCase()) || feature.name.toLowerCase() === entry.name.toLowerCase());
    const costMatch = feature.description.match(/(?:expend|spend)\s+(?:one|a|an|(\d+))\s+(?:use of (?:your )?)?([A-Za-z ]+?)(?:\.|,| to| point)/i);
    return {
      id: `feature-${feature.id ?? `${feature.name}-${index}`}`,
      name: feature.name,
      timing: actionTiming(feature.description),
      purpose: actionPurpose(feature.name, feature.description),
      source: "Feature",
      description: feature.description,
      resourceId: resource?.id,
      resourceCost: resource ? Math.max(1, Number(costMatch?.[1]) || 1) : undefined,
    } satisfies GeneratedAction;
  });
  const spellActions = character.spells.filter((spell) => spell.level === 0 || spell.prepared).map((spell) => ({
    id: `spell-${spell.id}`,
    name: spell.name,
    timing: /bonus action/i.test(spell.castingTime) ? "bonus" as const : /reaction/i.test(spell.castingTime) ? "reaction" as const : "action" as const,
    purpose: (/heal|hit points?|restore/i.test(`${spell.name} ${spell.description}`) ? "healing" : /attack roll|\bdamage\b/i.test(spell.description) ? "attack" : /condition|charmed|frightened|paralyzed|restrained|stunned/i.test(spell.description) ? "control" : "spell") as GeneratedAction["purpose"],
    source: `Spell · ${spell.level ? `Level ${spell.level}` : "Cantrip"}`,
    description: spell.description,
    spellId: spell.id,
  }));
  const attackActions = character.attacks.map((attack) => {
    const inventoryItem = attack.inventoryItemId ? character.inventory.find((item) => item.id === attack.inventoryItemId) : undefined;
    return { id: `attack-${attack.id}`, name: attack.name, timing: "action" as const, purpose: "attack" as const, source: "Attack", description: `${attack.damage} ${attack.damageType}${attack.notes ? ` · ${attack.notes}` : ""}`, attackId: attack.id, ...(inventoryItem?.ammunition !== undefined ? { ammunitionItemId: inventoryItem.id } : {}) };
  });
  const itemActions = character.inventory.flatMap((item) => {
    const definition = item.contentId ? catalog.find((entry) => entry.id === item.contentId) : undefined;
    const description = [definition?.description, item.notes].filter(Boolean).join("\n\n") || "Use this equipped item.";
    const describedConsumable = item.quantity > 0 && /\b(?:drink|administer|consume)\b[\s\S]*?\b(?:heal|regain|restore|hit points?)\b|\b(?:heal|regain|restore|hit points?)\b[\s\S]*?\b(?:drink|administer|consume)\b/i.test(description);
    if (!(item.equipped && (item.consumable || item.maximumCharges !== undefined)) && !describedConsumable) return [];
    return [{ id: `item-${item.id}`, name: item.name, timing: actionTiming(description), purpose: (/heal|hit points?|restore/i.test(`${item.name} ${description}`) ? "healing" : "item") as GeneratedAction["purpose"], source: "Equipment", description, inventoryId: item.id }];
  });
  const companionActions = character.companions.filter((companion) => companion.active).map((companion) => ({
    id: `companion-${companion.id}`,
    name: `${companion.name} action`,
    timing: "action" as const,
    purpose: "companion" as const,
    source: `Companion · ${companion.name}`,
    description: companion.notes || companion.description || `Use ${companion.name}'s listed action.`,
  }));
  const standardActions: GeneratedAction[] = [
    { id: "standard-attack", name: "Attack", timing: "action", purpose: "attack", source: "Standard action", description: "Make one attack with a weapon or an unarmed strike. Use a tracked attack when available." },
    { id: "standard-dash", name: "Dash", timing: "action", purpose: "utility", source: "Standard action", description: "Gain extra movement for the current turn equal to your Speed after modifiers." },
    { id: "standard-disengage", name: "Disengage", timing: "action", purpose: "defense", source: "Standard action", description: "Your movement does not provoke opportunity attacks for the rest of the turn." },
    { id: "standard-dodge", name: "Dodge", timing: "action", purpose: "defense", source: "Standard action", description: "Until your next turn, attacks against you have disadvantage when you can see the attacker, and you have advantage on Agility saving throws." },
    { id: "standard-help", name: "Help", timing: "action", purpose: "utility", source: "Standard action", description: "Assist another creature with an ability check or distract a nearby enemy for an ally's next attack." },
    { id: "standard-hide", name: "Hide", timing: "action", purpose: "defense", source: "Standard action", description: "Make an Agility (Stealth) check while sufficiently concealed to become hidden." },
    { id: "standard-ready", name: "Ready", timing: "action", purpose: "control", source: "Standard action", description: "Choose a trigger and an action or movement to resolve with your Reaction before your next turn." },
    { id: "standard-search", name: "Search", timing: "action", purpose: "utility", source: "Standard action", description: "Make an appropriate check to find something concealed or discernible." },
    { id: "standard-move", name: "Move", timing: "movement", purpose: "utility", source: "Movement", description: "Move up to your current Speed, splitting the movement around other actions if needed." },
    { id: "standard-interact", name: "Interact", timing: "other", purpose: "utility", source: "Free / Other", description: "Perform a brief object interaction or other simple activity allowed during your turn." },
  ];
  return [...attackActions, ...spellActions, ...featureActions, ...itemActions, ...companionActions, ...standardActions];
}

export function activeEffectFromSpell(spell: SpellDefinition): ActiveEffect | null {
  if (/instantaneous/i.test(spell.duration)) return null;
  const concentration = /concentration|^c(?:,|\b)/i.test(spell.duration);
  const roundMatch = spell.duration.match(/(\d+)\s+round/i);
  const minuteMatch = spell.duration.match(/(\d+)\s+minute/i);
  const hourMatch = spell.duration.match(/(\d+)\s+hour/i);
  const rounds = roundMatch ? Number(roundMatch[1]) : minuteMatch ? Number(minuteMatch[1]) * 10 : hourMatch ? Number(hourMatch[1]) * 600 : undefined;
  return { id: crypto.randomUUID(), name: spell.name, source: "Spell", duration: rounds ? "rounds" : "manual", remaining: rounds, concentration };
}

export function concentrationSave(character: CharacterData, damage: number) {
  const dc = Math.max(10, Math.floor(Math.max(0, damage) / 2));
  const modifier = abilityModifier(character.abilities.stamina) + (character.savingThrowProficiencies.includes("stamina") ? character.proficiencyBonus : 0) + (character.savingThrowBonuses.stamina ?? 0);
  const advantage = character.feats.some((feat) => /war caster/i.test(feat.name));
  const rolls = advantage ? [Math.floor(Math.random() * 20) + 1, Math.floor(Math.random() * 20) + 1] : [Math.floor(Math.random() * 20) + 1];
  const roll = Math.max(...rolls);
  return { dc, modifier, rolls, total: roll + modifier, success: roll + modifier >= dc, advantage };
}

function automaticResourcesFor(className: string, level: number, abilities: CharacterData["abilities"]): CharacterResource[] {
  const normalizedClass = className.trim().toLowerCase();
  const templates: Array<Omit<CharacterResource, "id" | "current">> = [];
  const add = (name: string, maximum: number, recovery: CharacterResource["recovery"]) => templates.push({ name, maximum, recovery, automatic: true, source: className });
  if (normalizedClass === "barbarian") add("Rage", level >= 17 ? 6 : level >= 12 ? 5 : level >= 6 ? 4 : level >= 3 ? 3 : 2, "short-one");
  if (normalizedClass === "bard") add("Bardic Inspiration", Math.max(1, abilityModifier(abilities.charisma)), level >= 5 ? "short" : "long");
  if (normalizedClass === "priest" && level >= 2) add("Channel Faith", level >= 18 ? 4 : level >= 6 ? 3 : 2, "short-one");
  if (normalizedClass === "warrior") add("Second Wind", level >= 10 ? 4 : level >= 4 ? 3 : 2, "short-one");
  if (normalizedClass === "monk" && level >= 2) add("Focus Points", level, "short");
  if (normalizedClass === "paladin") {
    add("Lay on Hands", level * 5, "long");
    if (level >= 3) add("Channel Faith", 2, "short-one");
  }
  if (normalizedClass === "hunter") add("Favored Enemy", level >= 17 ? 6 : level >= 13 ? 5 : level >= 9 ? 4 : level >= 5 ? 3 : 2, "long");
  if (normalizedClass === "sorcerer") {
    add("Innate Sorcery", 2, "long");
    if (level >= 2) add("Sorcery Points", level, "long");
  }
  if (normalizedClass === "mage") add("Arcane Recovery", 1, "long");
  return templates.map((template) => ({ ...template, id: crypto.randomUUID(), current: template.maximum }));
}

function syncResourceTemplates(resources: CharacterResource[], templates: CharacterResource[]) {
  const templateNames = new Set(templates.map((template) => template.name.toLowerCase()));
  const result = resources.filter((resource) => !resource.automatic || templateNames.has(resource.name.toLowerCase()));
  for (const template of templates) {
    const index = result.findIndex((resource) => resource.name.toLowerCase() === template.name.toLowerCase());
    if (index < 0) {
      result.push(template);
      continue;
    }
    const current = result[index];
    const gained = Math.max(0, template.maximum - current.maximum);
    result[index] = { ...current, ...template, id: current.id, current: Math.min(template.maximum, current.current + gained) };
  }
  return result;
}

export function syncAutomaticResources(resources: CharacterResource[], className: string, level: number, abilities: CharacterData["abilities"]) {
  return syncResourceTemplates(resources, automaticResourcesFor(className, level, abilities));
}

export function syncMulticlassResources(resources: CharacterResource[], classLevels: CharacterClassLevel[], abilities: CharacterData["abilities"]) {
  const byName = new Map<string, CharacterResource>();
  for (const entry of classLevels) {
    for (const template of automaticResourcesFor(entry.className, entry.level, abilities)) {
      const key = template.name.toLowerCase();
      const existing = byName.get(key);
      if (!existing || template.maximum > existing.maximum) byName.set(key, template);
    }
  }
  return syncResourceTemplates(resources, [...byName.values()]);
}

export function extractDiceFormula(text: string) {
  return text.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/i)?.[0]?.replace(/\s+/g, "") ?? null;
}

export function spellSaveAbility(text: string): AbilityKey | null {
  const match = text.match(/(Strength|Agility|Dexterity|Stamina|Constitution|Intellect|Intelligence|Spirit|Wisdom|Charisma) saving throw/i)?.[1]?.toLowerCase();
  if (!match) return null;
  const aliases: Record<string, AbilityKey> = { strength: "strength", agility: "agility", dexterity: "agility", stamina: "stamina", constitution: "stamina", intellect: "intellect", intelligence: "intellect", spirit: "spirit", wisdom: "spirit", charisma: "charisma" };
  return aliases[match] ?? null;
}

export type SpellDamageProfile = {
  formula: string;
  damageType: string;
  instances: number;
  instanceLabel?: string;
  automatic: boolean;
};

export type SpellHealingProfile = {
  formula: string;
  addsSpellcastingModifier: boolean;
};

function diceFormulaMatches(text: string) {
  return Array.from(text.matchAll(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/gi));
}

function healingDiceFormula(text: string) {
  for (const match of diceFormulaMatches(text)) {
    const index = match.index ?? 0;
    const context = text.slice(Math.max(0, index - 90), Math.min(text.length, index + match[0].length + 90));
    if (/regain|restore|healing|hit points?/i.test(context) && !/\b(?:takes?|deals?)\b[^.]{0,60}\bdamage\b/i.test(context)) return match[0].replace(/\s+/g, "");
  }
  return null;
}

export function spellHealingProfile(spell: Pick<SpellDefinition, "level" | "description">, slotLevel = spell.level): SpellHealingProfile | null {
  if (!/regain|restore|healing|hit points?/i.test(spell.description)) return null;
  const extracted = healingDiceFormula(spell.description);
  if (!extracted) return null;
  const parsed = extracted.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!parsed) return null;
  let diceCount = Number(parsed[1]);
  const sides = Number(parsed[2]);
  const modifier = parsed[3] ?? "";
  const slotIncrease = spell.description.match(/(?:healing|hit points?)[^.]*?increases by\s+(\d+)d(\d+)\s+for each spell slot level above\s+(\d+)/i);
  if (slotIncrease && Number(slotIncrease[2]) === sides) diceCount += Number(slotIncrease[1]) * Math.max(0, slotLevel - Number(slotIncrease[3]));
  return { formula: `${diceCount}d${sides}${modifier}`, addsSpellcastingModifier: /spellcasting ability modifier/i.test(spell.description) };
}

export function spellDamageProfile(spell: Pick<SpellDefinition, "id" | "name" | "level" | "description">, slotLevel = spell.level, characterLevel = 1): SpellDamageProfile | null {
  if (!/\bdamage\b/i.test(spell.description)) return null;
  const damagePattern = new RegExp(`\\b(\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)\\s+(?:${DAMAGE_TYPES.join("|")})\\s+damage`, "i");
  const extracted = spell.description.match(damagePattern)?.[1]?.replace(/\s+/g, "") ?? extractDiceFormula(spell.description);
  if (!extracted) return null;
  const parsed = extracted.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
  if (!parsed) return null;
  let diceCount = Number(parsed[1]);
  const sides = Number(parsed[2]);
  const modifier = parsed[3] ?? "";

  const cantripIncrease = spell.description.match(/Cantrip Upgrade[\s\S]*?damage increases by\s+(\d+)d(\d+)/i);
  if (spell.level === 0 && cantripIncrease && Number(cantripIncrease[2]) === sides) {
    const steps = characterLevel >= 17 ? 3 : characterLevel >= 11 ? 2 : characterLevel >= 5 ? 1 : 0;
    diceCount += Number(cantripIncrease[1]) * steps;
  }

  const slotIncrease = spell.description.match(/damage increases by\s+(\d+)d(\d+)\s+for each spell slot level above\s+(\d+)/i);
  if (slotIncrease && Number(slotIncrease[2]) === sides) {
    diceCount += Number(slotIncrease[1]) * Math.max(0, slotLevel - Number(slotIncrease[3]));
  }

  const damageType = spell.description.match(new RegExp(`\\b(?:\\d+d\\d+(?:\\s*[+-]\\s*\\d+)?)\\s+(${DAMAGE_TYPES.join("|")})\\s+damage`, "i"))?.[1] ?? "";
  const missileSpell = spell.id.toLowerCase() === "magic-missile" || /(?:three|3)\s+(?:glowing\s+)?darts[\s\S]*?each dart/i.test(spell.description);
  const instances = missileSpell ? 3 + Math.max(0, slotLevel - 1) : 1;
  return {
    formula: `${diceCount}d${sides}${modifier}`,
    damageType,
    instances,
    ...(missileSpell ? { instanceLabel: "dart" } : {}),
    automatic: !/spell attack/i.test(spell.description) && !spellSaveAbility(spell.description),
  };
}

export function rollDiceFormula(formula: string, critical = false, extraModifier = 0) {
  const match = formula.trim().match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;
  const baseDice = Math.max(1, Math.min(100, Number(match[1])));
  const sides = Math.max(2, Math.min(1000, Number(match[2])));
  const diceCount = critical ? baseDice * 2 : baseDice;
  const rolls = Array.from({ length: diceCount }, () => Math.floor(Math.random() * sides) + 1);
  const formulaModifier = match[3] ? (match[3] === "-" ? -1 : 1) * Number(match[4]) : 0;
  const modifier = formulaModifier + extraModifier;
  return { formula, rolls, modifier, total: rolls.reduce((sum, roll) => sum + roll, 0) + modifier, critical };
}

export function resolveIncomingDamage(amount: number, damageType: string, character: CharacterData) {
  const safeAmount = Math.max(0, Math.floor(amount || 0));
  const normalizedType = damageType.trim().toLowerCase();
  const has = (values: string[]) => values.some((value) => value.toLowerCase() === normalizedType);
  const immune = has(character.damageImmunities);
  const resistant = has(character.damageResistances);
  const vulnerable = has(character.damageVulnerabilities);
  const multiplier = immune ? 0 : resistant === vulnerable ? 1 : resistant ? 0.5 : 2;
  const adjusted = multiplier === 0.5 ? Math.floor(safeAmount / 2) : safeAmount * multiplier;
  return {
    adjusted,
    multiplier,
    reason: immune ? `Immune to ${damageType}` : resistant && vulnerable ? "Resistance and vulnerability cancel" : resistant ? `Resistance to ${damageType}` : vulnerable ? `Vulnerable to ${damageType}` : "No damage modifier",
  };
}

export function attackFromEquipment(item: EquipmentDefinition, proficient = true, masteryActive = false, inventoryItemId?: string): CharacterAttack {
  const usesAgility = item.category.toLowerCase().includes("ranged") || item.properties?.some((property) => property.toLowerCase() === "finesse");
  return {
    id: crypto.randomUUID(),
    contentId: item.id,
    ...(inventoryItemId ? { inventoryItemId } : {}),
    name: item.name,
    ability: usesAgility ? "agility" : "strength",
    proficient,
    bonus: 0,
    damage: item.damage ?? "",
    damageType: item.damageType ?? "",
    damageBonus: 0,
    notes: [item.properties?.join(", "), item.mastery ? `${masteryActive ? "Mastery" : "Mastery not selected"}: ${item.mastery}` : ""].filter(Boolean).join(" · "),
  };
}

export function conditionRollEffects(character: CharacterData, kind: RollKind, ability?: AbilityKey, skillName = "", catalog: EquipmentDefinition[] = []) {
  const conditions = new Set(character.conditions);
  const reasons: string[] = [];
  if (kind === "attack" && conditions.has("Blinded")) reasons.push("Blinded");
  if ((kind === "attack" || kind === "ability") && conditions.has("Poisoned")) reasons.push("Poisoned");
  if (kind === "attack" && conditions.has("Prone")) reasons.push("Prone");
  if (kind === "attack" && conditions.has("Restrained")) reasons.push("Restrained");
  if (kind === "save" && ability === "agility" && conditions.has("Restrained")) reasons.push("Restrained");
  if (encumbranceDisadvantage(character, kind, ability)) reasons.push("Heavily encumbered");
  if (kind === "ability" && skillName === "Stealth" && equippedArmorEffects(character, catalog).stealthDisadvantage) reasons.push("Equipped armor");
  if (hasUnproficientArmor(character, catalog) && (kind === "attack" || ability === "strength" || ability === "agility")) reasons.push("Armor without proficiency");
  return {
    forcedDisadvantage: reasons.length > 0,
    reasons,
    modifier: -2 * Math.max(0, Math.min(6, character.exhaustionLevel || 0)),
  };
}

function encumbranceDisadvantage(character: CharacterData, kind: RollKind, ability?: AbilityKey) {
  const encumbrance = calculateEncumbrance(character.inventory, character.abilities.strength);
  if (encumbrance.level !== "heavily-encumbered" && encumbrance.level !== "over-capacity") return false;
  if (!ability || !(["strength", "agility", "stamina"] as AbilityKey[]).includes(ability)) return false;
  return kind === "ability" || kind === "attack" || kind === "save";
}

export function resolvedRollMode(selected: RollMode, forcedDisadvantage: boolean): RollMode {
  if (!forcedDisadvantage) return selected;
  return selected === "advantage" ? "normal" : "disadvantage";
}

export function rollD20(mode: RollMode) {
  const d20 = () => Math.floor(Math.random() * 20) + 1;
  const dice = mode === "normal" ? [d20()] : [d20(), d20()];
  const kept = mode === "advantage" ? Math.max(...dice) : mode === "disadvantage" ? Math.min(...dice) : dice[0];
  return { dice, kept, mode };
}

export function conditionEffectText(condition: string, exhaustionLevel = 0) {
  const effects: Record<string, string> = {
    Blinded: "Your attacks have disadvantage; sight-dependent checks fail.",
    Charmed: "You can't attack the charmer, and it has advantage on social checks against you.",
    Deafened: "Hearing-dependent checks fail.",
    Frightened: "Checks and attacks have disadvantage while the source is in sight; you can't willingly approach it.",
    Grappled: "Speed is 0.",
    Incapacitated: "You can't take actions, Bonus Actions, or Reactions; Concentration ends.",
    Invisible: "Your attacks have advantage and attacks against you have disadvantage when the attacker can't see you.",
    Paralyzed: "Speed is 0; you are Incapacitated and automatically fail Strength and Agility saves.",
    Petrified: "Speed is 0; you are Incapacitated and gain broad damage resistance.",
    Poisoned: "Ability checks and attack rolls have disadvantage.",
    Prone: "Your attacks have disadvantage; standing costs half your Speed.",
    Restrained: "Speed is 0; attacks and Agility saves have disadvantage.",
    Stunned: "Speed is 0; you are Incapacitated and automatically fail Strength and Agility saves.",
    Unconscious: "Speed is 0; you are Incapacitated, unaware, and Prone.",
  };
  if (condition === "Exhaustion") return `Level ${Math.max(1, exhaustionLevel)}: −${Math.max(1, exhaustionLevel) * 2} to D20 Tests and −${Math.max(1, exhaustionLevel) * 5} ft. Speed.`;
  return effects[condition] ?? "See the condition rules for its current effects.";
}
