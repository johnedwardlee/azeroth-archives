import {
  abilityModifier,
  type AbilityKey,
  type CharacterAttack,
  type CharacterData,
  type CharacterResource,
  type EquipmentDefinition,
  type InventoryItem,
  type SpellSlotState,
} from "./types";

export type EncumbranceLevel = "unencumbered" | "encumbered" | "heavily-encumbered" | "over-capacity";
export type RollKind = "ability" | "attack" | "save";
export type RollMode = "normal" | "advantage" | "disadvantage";

export const DAMAGE_TYPES = ["Acid", "Bludgeoning", "Cold", "Fire", "Force", "Lightning", "Necrotic", "Piercing", "Poison", "Psychic", "Radiant", "Slashing", "Thunder"];

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

export function calculateEncumbrance(inventory: InventoryItem[], strengthScore: number) {
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

  if (totalWeight > carryingCapacity) {
    level = "over-capacity";
    label = "Over capacity";
    penalty = `Cannot normally carry this load. Remove at least ${formatPounds(totalWeight - carryingCapacity)} lb.`;
  } else if (totalWeight > heavilyEncumberedAt) {
    level = "heavily-encumbered";
    label = "Heavily encumbered";
    penalty = "Speed −20 ft.; disadvantage on Strength, Agility, and Stamina ability checks, attack rolls, and saving throws.";
    speedPenalty = 20;
  } else if (totalWeight > encumberedAt) {
    level = "encumbered";
    label = "Encumbered";
    penalty = "Speed −10 ft.";
    speedPenalty = 10;
  }

  const loadPercent = carryingCapacity ? Math.min(100, totalWeight / carryingCapacity * 100) : 0;
  return { strength, totalWeight, unlistedWeightItems, encumberedAt, heavilyEncumberedAt, carryingCapacity, loadPercent, level, label, penalty, speedPenalty };
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

export function syncAutomaticResources(resources: CharacterResource[], className: string, level: number, abilities: CharacterData["abilities"]) {
  const templates = automaticResourcesFor(className, level, abilities);
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

export function extractDiceFormula(text: string) {
  return text.match(/\b\d+d\d+(?:\s*[+-]\s*\d+)?\b/i)?.[0]?.replace(/\s+/g, "") ?? null;
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

export function attackFromEquipment(item: EquipmentDefinition): CharacterAttack {
  const usesAgility = item.category.toLowerCase().includes("ranged") || item.properties?.some((property) => property.toLowerCase() === "finesse");
  return {
    id: crypto.randomUUID(),
    contentId: item.id,
    name: item.name,
    ability: usesAgility ? "agility" : "strength",
    proficient: true,
    bonus: 0,
    damage: item.damage ?? "",
    damageType: item.damageType ?? "",
    damageBonus: 0,
    notes: [item.properties?.join(", "), item.mastery ? `Mastery: ${item.mastery}` : ""].filter(Boolean).join(" · "),
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
