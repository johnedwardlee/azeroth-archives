import {
  abilityModifier,
  type AbilityKey,
  type CharacterAttack,
  type CharacterData,
  type EquipmentDefinition,
  type InventoryItem,
} from "./types";

export type EncumbranceLevel = "unencumbered" | "encumbered" | "heavily-encumbered" | "over-capacity";
export type RollKind = "ability" | "attack" | "save";
export type RollMode = "normal" | "advantage" | "disadvantage";

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

export function calculateEffectiveSpeed(character: CharacterData, encumbrance = calculateEncumbrance(character.inventory, character.abilities.strength)) {
  const exhaustionPenalty = Math.max(0, Math.min(6, character.exhaustionLevel || 0)) * 5;
  const stoppedBy = character.conditions.find((condition) => zeroSpeedConditions.has(condition));
  const overCapacity = encumbrance.level === "over-capacity";
  const value = stoppedBy || overCapacity ? 0 : Math.max(0, character.speed - encumbrance.speedPenalty - exhaustionPenalty);
  const effects = [
    encumbrance.speedPenalty ? `Encumbrance −${encumbrance.speedPenalty} ft.` : "",
    exhaustionPenalty ? `Exhaustion −${exhaustionPenalty} ft.` : "",
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
    notes: [item.properties?.join(", "), item.mastery ? `Mastery: ${item.mastery}` : ""].filter(Boolean).join(" · "),
  };
}

export function conditionRollEffects(character: CharacterData, kind: RollKind, ability?: AbilityKey) {
  const conditions = new Set(character.conditions);
  const reasons: string[] = [];
  if (kind === "attack" && conditions.has("Blinded")) reasons.push("Blinded");
  if ((kind === "attack" || kind === "ability") && conditions.has("Poisoned")) reasons.push("Poisoned");
  if (kind === "attack" && conditions.has("Prone")) reasons.push("Prone");
  if (kind === "attack" && conditions.has("Restrained")) reasons.push("Restrained");
  if (kind === "save" && ability === "agility" && conditions.has("Restrained")) reasons.push("Restrained");
  if (encumbranceDisadvantage(character, kind, ability)) reasons.push("Heavily encumbered");
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
