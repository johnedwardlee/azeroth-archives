export type AbilityKey = "strength" | "agility" | "stamina" | "intellect" | "spirit" | "charisma";

export type RulesFeature = {
  id?: string;
  name: string;
  aliases?: string[];
  description: string;
  source?: string;
};

export type AncestryDefinition = {
  id: string;
  name: string;
  aliases?: string[];
  speed: number;
  abilityBonuses?: Partial<Record<AbilityKey, number>>;
  traits: RulesFeature[];
};

export type ClassDefinition = {
  id: string;
  name: string;
  aliases?: string[];
  hitDie: number;
  primaryAbility: AbilityKey;
  levelFeatures: Record<string, RulesFeature[]>;
  description?: string;
  savingThrowProficiencies?: AbilityKey[];
  subclasses?: SubclassDefinition[];
};

export type SubclassDefinition = {
  id: string;
  name: string;
  aliases?: string[];
  levelFeatures: Record<string, RulesFeature[]>;
  description?: string;
};

export type BackgroundDefinition = {
  id: string;
  name: string;
  aliases?: string[];
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
  aliases?: string[];
  category: string;
  prerequisite?: string;
  description: string;
  source?: string;
};

export type EquipmentDefinition = {
  id: string;
  name: string;
  aliases?: string[];
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
  aliases?: string[];
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
  aliases?: string[];
  challengeRating?: string;
  description: string;
  source?: string;
};

export type CharacterClassLevel = {
  className: string;
  subclassName?: string;
  level: number;
};

export type AbilityScoreMethod = "standard-array" | "point-buy" | "rolled" | "manual";
export type EncumbranceRule = "variant" | "standard" | "none";
export type StartingEquipmentRule = "packages-or-gold" | "packages-only" | "gold-only";
export type AppRole = "player" | "dm";
export type SyncRole = "dm" | "player";
export type SyncConnectionState = "unconfigured" | "signed-out" | "connecting" | "live" | "offline" | "error";
export type MutationCategory = "vitals" | "resource" | "inventory" | "spells" | "identity" | "advancement" | "combat" | "features" | "journal" | "companions" | "preferences" | "other";
export type RollEventCategory = "initiative" | "attack" | "spell-attack" | "check" | "save" | "damage" | "healing" | "hit-dice" | "concentration" | "other";

export type CampaignProfile = {
  schemaVersion: 1;
  id: string;
  name: string;
  startingLevel: number;
  startingExperience: number;
  allowedPackIds: string[];
  allowedAbilityMethods: AbilityScoreMethod[];
  encumbranceRule: EncumbranceRule;
  startingEquipmentRule: StartingEquipmentRule;
  allowMulticlass: boolean;
  allowOptionalFeats: boolean;
  attunementLimit: number;
  houseRules: string;
  createdAt: string;
  updatedAt: string;
};

export type HitDicePool = { className: string; die: number; total: number; used: number };

export type CompanionKind = "companion" | "summon" | "form";

export type TrackedCompanion = {
  id: string;
  contentId?: string;
  name: string;
  kind: CompanionKind;
  active: boolean;
  currentHp: number;
  maxHp: number;
  armorClass: number;
  speed: string;
  challengeRating?: string;
  description: string;
  notes: string;
  source?: string;
};

export type JournalEntryType = "session" | "quest" | "npc" | "location" | "lore";
export type JournalEntryStatus = "active" | "completed" | "archived";

export type JournalEntry = {
  id: string;
  type: JournalEntryType;
  title: string;
  details: string;
  status: JournalEntryStatus;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RuleDefinition = {
  id: string;
  name: string;
  aliases?: string[];
  category: string;
  description: string;
  source?: string;
};

export type TrackedSpell = SpellDefinition & {
  prepared: boolean;
  alwaysPrepared?: boolean;
  className?: string;
  sourceFeatId?: string;
  castingAbility?: AbilityKey;
};

export type SpellcastingProfile = {
  className: string;
  ability: AbilityKey;
  preparedLimit: number | null;
  sourceFeatId?: string;
  spellList?: string;
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
  source?: string;
  weight?: string;
  cost?: string;
  charges?: number;
  maximumCharges?: number;
  ammunition?: number;
  consumable?: boolean;
  attuned?: boolean;
  container?: string;
  equipmentSlot?: EquipmentSlot;
};

export type EquipmentSlot = "none" | "main-hand" | "off-hand" | "two-hands" | "armor" | "worn";

export type AdvancementChoiceKind = "skill" | "expertise" | "weapon-mastery" | "fighting-style" | "metamagic" | "spell" | "other";

export type AdvancementChoice = {
  id: string;
  featureId?: string;
  featureName: string;
  level: number;
  kind: AdvancementChoiceKind;
  selections: string[];
};

export type ActiveEffect = {
  id: string;
  name: string;
  source: string;
  duration: "rounds" | "minutes" | "until-rest" | "manual";
  remaining?: number;
  concentration?: boolean;
  condition?: string;
};

export type CharacterAttack = {
  id: string;
  contentId?: string;
  inventoryItemId?: string;
  name: string;
  ability: AbilityKey;
  proficient: boolean;
  bonus: number;
  damage: string;
  damageType: string;
  damageBonus: number;
  notes: string;
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

export type ResourceRecovery = "short" | "short-one" | "long" | "manual";

export type CharacterResource = {
  id: string;
  name: string;
  current: number;
  maximum: number;
  recovery: ResourceRecovery;
  automatic?: boolean;
  source?: string;
};

export type ActionTiming = "action" | "bonus" | "reaction" | "movement" | "other" | "passive";

export type RecentActionUse = {
  actionId: string;
  name: string;
  source: string;
  timing: ActionTiming;
  result: string;
  usedAt: string;
};

export type FeatSpellcastingChoice = {
  featId: string;
  spellList: string;
  sourceName?: string;
  ability?: AbilityKey;
  cantripIds: string[];
  levelOneSpellId?: string;
  freeCastUsed: boolean;
  freeCastUsedSpellIds?: string[];
};

export type AdvancementSnapshot = {
  level: number;
  className: string;
  subclassName?: string;
  classLevels: CharacterClassLevel[];
  experience: number;
  currentHp: number;
  maxHp: number;
  proficiencyBonus: number;
  hitDiceTotal: number;
  hitDiceUsed: number;
  hitDiceByClass: HitDicePool[];
  abilities: Record<AbilityKey, number>;
  skillProficiencies: string[];
  skillExpertise: string[];
  weaponMasteries: string[];
  advancementChoices: AdvancementChoice[];
  resources: CharacterResource[];
  spellSlots: Record<string, SpellSlotState>;
  feats: TrackedFeat[];
  spells: TrackedSpell[];
  featSpellcastingChoices: FeatSpellcastingChoice[];
  features: RulesFeature[];
};

export type AdvancementHistoryEntry = {
  id: string;
  createdAt: string;
  totalLevel: number;
  className: string;
  classLevel: number;
  hpGain: number;
  summary: string;
  before: AdvancementSnapshot;
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
  schemaVersion: 6;
  id: string;
  name: string;
  portraitDataUrl?: string;
  playerName: string;
  ancestry: string;
  className: string;
  subclassName?: string;
  classLevels: CharacterClassLevel[];
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
  baseAbilities: Record<AbilityKey, number>;
  abilityScoreMethod: AbilityScoreMethod;
  backgroundAbilityBonuses: Partial<Record<AbilityKey, number>>;
  savingThrowProficiencies: AbilityKey[];
  skillProficiencies: string[];
  skillExpertise: string[];
  classSkillChoices: string[];
  languages: string[];
  toolProficiencies: string[];
  armorProficiencies: string[];
  weaponProficiencies: string[];
  weaponMasteries: string[];
  advancementChoices: AdvancementChoice[];
  advancementHistory: AdvancementHistoryEntry[];
  abilityScoresConfirmed: boolean;
  startingEquipmentConfirmed: boolean;
  startingEquipmentChoice: "" | "A" | "B";
  startingGold: number;
  attacks: CharacterAttack[];
  features: RulesFeature[];
  feats: TrackedFeat[];
  spells: TrackedSpell[];
  featSpellcastingChoices: FeatSpellcastingChoice[];
  spellSlots: Record<string, SpellSlotState>;
  concentratingSpellId?: string;
  activeEffects: ActiveEffect[];
  companions: TrackedCompanion[];
  inventory: InventoryItem[];
  currency: CurrencyState;
  resources: CharacterResource[];
  favoriteActionIds: string[];
  recentActions: RecentActionUse[];
  inspiration: boolean;
  hitDiceTotal: number;
  hitDiceUsed: number;
  hitDiceByClass: HitDicePool[];
  deathSaveSuccesses: number;
  deathSaveFailures: number;
  conditions: string[];
  exhaustionLevel: number;
  damageResistances: string[];
  damageVulnerabilities: string[];
  damageImmunities: string[];
  conditionImmunities: string[];
  savingThrowBonuses: Partial<Record<AbilityKey, number>>;
  journal: JournalEntry[];
  notes: string;
  campaignProfileId?: string;
  finalizedAt?: string;
  readOnlyReview?: boolean;
  reviewImportedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type CharacterSyncLink = {
  characterId: string;
  campaignId: string;
  campaignName: string;
  role: SyncRole;
  ownerUserId?: string;
  revision: number;
  linkedAt: string;
  lastSyncedAt?: string;
};

export type CharacterMutation = {
  kind: "character-mutation";
  id: string;
  campaignId: string;
  characterId: string;
  baseRevision: number;
  category: MutationCategory;
  patch: Partial<CharacterData>;
  debounceKey?: string;
  deferredUntil?: string;
  createdAt: string;
};

export type SharedRollEvent = {
  kind: "roll-event";
  id: string;
  campaignId: string;
  characterId: string;
  actorName: string;
  category: RollEventCategory;
  label: string;
  formula: string;
  dice: number[];
  modifier: number;
  total: number;
  mode: "normal" | "advantage" | "disadvantage";
  detail: string;
  hidden: boolean;
  createdAt: string;
};

export type SyncOutboxEntry = CharacterMutation | SharedRollEvent;

export type LiveCampaign = {
  id: string;
  name: string;
  role: SyncRole;
  createdAt: string;
  updatedAt: string;
};

export type LiveCampaignMember = {
  campaignId: string;
  userId: string;
  role: SyncRole;
  displayName: string;
  joinedAt: string;
  revokedAt?: string;
};

export type SyncedCharacterSnapshot = {
  character: CharacterData;
  campaignId: string;
  ownerUserId: string;
  revision: number;
  updatedAt: string;
};

export type LiveSyncStatus = {
  configured: boolean;
  connection: SyncConnectionState;
  authenticated: boolean;
  anonymous: boolean;
  userId?: string;
  email?: string;
  message: string;
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
