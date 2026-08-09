export type AbilityKey = "strength" | "agility" | "stamina" | "intellect" | "spirit" | "charisma";

export type RulesFeature = {
  id?: string;
  name: string;
  description: string;
  source?: string;
};

export type AncestryDefinition = {
  id: string;
  name: string;
  speed: number;
  abilityBonuses?: Partial<Record<AbilityKey, number>>;
  traits: RulesFeature[];
};

export type ClassDefinition = {
  id: string;
  name: string;
  hitDie: number;
  primaryAbility: AbilityKey;
  levelFeatures: Record<string, RulesFeature[]>;
  description?: string;
  subclasses?: SubclassDefinition[];
};

export type SubclassDefinition = {
  id: string;
  name: string;
  levelFeatures: Record<string, RulesFeature[]>;
  description?: string;
};

export type BackgroundDefinition = {
  id: string;
  name: string;
  skills: string[];
  feature?: RulesFeature;
  abilityOptions?: AbilityKey[];
  featId?: string;
  toolProficiencies?: string[];
  equipment?: string;
};

export type FeatDefinition = {
  id: string;
  name: string;
  category: string;
  prerequisite?: string;
  description: string;
  source?: string;
};

export type EquipmentDefinition = {
  id: string;
  name: string;
  category: string;
  description?: string;
  cost?: string;
  weight?: string;
  damage?: string;
  damageType?: string;
  properties?: string[];
  mastery?: string;
  source?: string;
};

export type SpellDefinition = {
  id: string;
  name: string;
  level: number;
  school: string;
  classes: string[];
  ritual?: boolean;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
  description: string;
  source?: string;
};

export type CreatureDefinition = {
  id: string;
  name: string;
  challengeRating?: string;
  description: string;
  source?: string;
};

export type RuleDefinition = {
  id: string;
  name: string;
  category: string;
  description: string;
  source?: string;
};

export type TrackedSpell = SpellDefinition & {
  prepared: boolean;
};

export type TrackedFeat = FeatDefinition;

export type InventoryItem = {
  id: string;
  contentId?: string;
  name: string;
  category?: string;
  quantity: number;
  equipped: boolean;
  notes: string;
  weight?: string;
  cost?: string;
};

export type SpellSlotState = {
  maximum: number;
  used: number;
};

export type CurrencyState = {
  copper: number;
  silver: number;
  gold: number;
};

export type ContentPack = {
  schemaVersion: "1.0" | "2.0";
  pack: {
    id: string;
    name: string;
    version: string;
    description?: string;
    source?: string;
  };
  ancestries?: AncestryDefinition[];
  classes?: ClassDefinition[];
  backgrounds?: BackgroundDefinition[];
  feats?: FeatDefinition[];
  equipment?: EquipmentDefinition[];
  spells?: SpellDefinition[];
  creatures?: CreatureDefinition[];
  rules?: RuleDefinition[];
};

export type CharacterData = {
  id: string;
  name: string;
  playerName: string;
  ancestry: string;
  className: string;
  subclassName?: string;
  background: string;
  level: number;
  experience: number;
  currentHp: number;
  maxHp: number;
  temporaryHp: number;
  armorClass: number;
  speed: number;
  proficiencyBonus: number;
  abilities: Record<AbilityKey, number>;
  features: RulesFeature[];
  feats: TrackedFeat[];
  spells: TrackedSpell[];
  spellSlots: Record<string, SpellSlotState>;
  inventory: InventoryItem[];
  currency: CurrencyState;
  inspiration: boolean;
  hitDiceTotal: number;
  hitDiceUsed: number;
  deathSaveSuccesses: number;
  deathSaveFailures: number;
  conditions: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export const ABILITY_LABELS: Record<AbilityKey, string> = {
  strength: "Strength",
  agility: "Agility",
  stamina: "Stamina",
  intellect: "Intellect",
  spirit: "Spirit",
  charisma: "Charisma",
};

export function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

export function proficiencyForLevel(level: number) {
  return 2 + Math.floor((Math.max(1, level) - 1) / 4);
}
