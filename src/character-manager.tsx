"use client";

import {
  BookOpen,
  Copy,
  Download,
  FileDown,
  FileJson,
  Heart,
  HardDrive,
  LibraryBig,
  Menu,
  MoreHorizontal,
  Plus,
  Save,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trash2,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { FeatManager, InventoryManager, SessionTracker, SpellbookManager } from "./living-sheet";
import { CombatManager, SKILLS } from "./combat-sheet";
import { ActionDashboard } from "./action-dashboard";
import { CreationGuide } from "./creation-guide";
import { SettingsPanel } from "./settings-panel";
import { DescriptionPicker } from "./description-picker";
import { AdvancementPanel } from "./advancement-panel";
import { CompanionManager } from "./companion-manager";
import { JournalManager } from "./journal-manager";
import { ContentPackWorkshop } from "./content-pack-workshop";
import { buildCharacterPdf, type CharacterPdfSection } from "./character-pdf";
import bundledWarcraftPackJson from "../content-packs/warcraft5e-campaign.w5e?raw";
import packageMetadata from "../package.json";
import { assertContentPack, contentPackValidationError } from "../lib/content-validation";
import {
  calculateArmorClass,
  calculateEffectiveSpeed,
  calculateEncumbrance,
  advancementPromptsForFeatures,
  classTrainingFor,
  METAMAGIC_OPTIONS,
  isEquipmentProficient,
  conditionEffectText,
  preparedSpellLimitFor,
  progressionSpellSlots,
  syncMulticlassResources,
  syncMulticlassSpellSlots,
  syncAutomaticResources,
  syncProgressionSpellSlots,
  spellcastingAbilityForClass,
} from "../lib/character-rules";
import {
  ABILITY_LABELS,
  abilityModifier,
  proficiencyForLevel,
  type AbilityKey,
  type AdvancementChoice,
  type AncestryDefinition,
  type BackgroundDefinition,
  type AdvancementSnapshot,
  type CharacterData,
  type CharacterClassLevel,
  type ClassDefinition,
  type ContentPack,
  type RulesFeature,
} from "../lib/types";

type Tab = "overview" | "features" | "actions" | "combat" | "spells" | "equipment" | "companions" | "notes";
export const CURRENT_STORE_VERSION = 4 as const;
export const CURRENT_CHARACTER_SCHEMA_VERSION = 4 as const;
export type OfflineStore = {
  version: 4;
  characters: CharacterData[];
  packs: ContentPack[];
  disabledPackIds: string[];
  recovery?: { restoredFrom?: string; migrationBackup?: string };
};

const abilityKeys = Object.keys(ABILITY_LABELS) as AbilityKey[];
const browserStorageKey = "azeroth-archives-offline-data";
const bundledWarcraftPack = JSON.parse(bundledWarcraftPackJson) as ContentPack;
const bundledPackId = bundledWarcraftPack.pack.id;

function withBundledPack(packs: ContentPack[]) {
  return [bundledWarcraftPack, ...packs.filter((pack) => pack.pack.id !== bundledPackId)];
}

function readBrowserStore(): OfflineStore {
  try {
    return migrateOfflineStore(JSON.parse(localStorage.getItem(browserStorageKey) ?? "null"));
  } catch {
    return { version: CURRENT_STORE_VERSION, characters: [], packs: [], disabledPackIds: [] };
  }
}

function writeBrowserStore(store: OfflineStore) {
  localStorage.setItem(browserStorageKey, JSON.stringify(store));
}

function resizePortrait(file: File) {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Choose an image file"));
  if (file.size > 15 * 1024 * 1024) return Promise.reject(new Error("Portrait images must be smaller than 15 MB"));

  return new Promise<string>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 512;
      const context = canvas.getContext("2d");
      if (!context || !sourceSize) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("That image could not be read"));
        return;
      }
      context.fillStyle = "#dce8f5";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/jpeg", 0.88));
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("That image could not be read"));
    };
    image.src = objectUrl;
  });
}

export function newCharacter(): CharacterData {
  const now = new Date().toISOString();
  return {
    schemaVersion: CURRENT_CHARACTER_SCHEMA_VERSION,
    id: "draft",
    name: "New Hero",
    playerName: "",
    ancestry: "",
    className: "",
    subclassName: "",
    classLevels: [],
    background: "",
    level: 1,
    experience: 0,
    currentHp: 12,
    maxHp: 12,
    temporaryHp: 0,
    armorClass: 14,
    speed: 30,
    proficiencyBonus: 2,
    abilities: { strength: 15, agility: 14, stamina: 13, intellect: 12, spirit: 10, charisma: 8 },
    baseAbilities: { strength: 15, agility: 14, stamina: 13, intellect: 12, spirit: 10, charisma: 8 },
    abilityScoreMethod: "standard-array",
    backgroundAbilityBonuses: {},
    savingThrowProficiencies: [],
    skillProficiencies: [],
    skillExpertise: [],
    classSkillChoices: [],
    languages: [],
    toolProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    weaponMasteries: [],
    advancementChoices: [],
    advancementHistory: [],
    abilityScoresConfirmed: false,
    startingEquipmentConfirmed: false,
    startingEquipmentChoice: "",
    startingGold: 0,
    attacks: [],
    features: [],
    feats: [],
    spells: [],
    spellSlots: {},
    concentratingSpellId: undefined,
    activeEffects: [],
    companions: [],
    inventory: [],
    currency: { copper: 0, silver: 0, gold: 0 },
    resources: [],
    inspiration: false,
    hitDiceTotal: 1,
    hitDiceUsed: 0,
    hitDiceByClass: [],
    deathSaveSuccesses: 0,
    deathSaveFailures: 0,
    conditions: [],
    exhaustionLevel: 0,
    damageResistances: [],
    damageVulnerabilities: [],
    damageImmunities: [],
    conditionImmunities: [],
    savingThrowBonuses: {},
    journal: [],
    notes: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeCharacter(value: Partial<CharacterData>): CharacterData {
  const defaults = newCharacter();
  const legacyLevel = Math.max(1, Math.min(20, Number(value.level ?? 1) || 1));
  const classLevels: CharacterClassLevel[] = Array.isArray(value.classLevels)
    ? value.classLevels.filter((entry) => entry && typeof entry.className === "string" && entry.className.trim()).map((entry) => ({ className: entry.className.trim(), subclassName: typeof entry.subclassName === "string" ? entry.subclassName : "", level: Math.max(1, Math.min(20, Number(entry.level) || 1)) }))
    : [];
  if (!classLevels.length && typeof value.className === "string" && value.className.trim()) classLevels.push({ className: value.className.trim(), subclassName: value.subclassName ?? "", level: legacyLevel });
  const totalLevel = classLevels.length ? Math.min(20, classLevels.reduce((total, entry) => total + entry.level, 0)) : legacyLevel;
  const maximumHitDice = Math.max(1, Number(value.hitDiceTotal ?? totalLevel));
  const normalized: CharacterData = {
    ...defaults,
    ...value,
    schemaVersion: CURRENT_CHARACTER_SCHEMA_VERSION,
    abilities: { ...defaults.abilities, ...(value.abilities ?? {}) },
    baseAbilities: { ...defaults.baseAbilities, ...(value.baseAbilities ?? value.abilities ?? {}) },
    abilityScoreMethod: (["standard-array", "point-buy", "rolled", "manual"] as const).includes(value.abilityScoreMethod ?? "manual") ? value.abilityScoreMethod ?? "manual" : "manual",
    backgroundAbilityBonuses: value.backgroundAbilityBonuses && typeof value.backgroundAbilityBonuses === "object" ? value.backgroundAbilityBonuses : {},
    portraitDataUrl: typeof value.portraitDataUrl === "string" && value.portraitDataUrl.startsWith("data:image/") ? value.portraitDataUrl : undefined,
    subclassName: value.subclassName ?? "",
    classLevels,
    level: totalLevel,
    temporaryHp: Math.max(0, Number(value.temporaryHp ?? 0)),
    savingThrowProficiencies: Array.isArray(value.savingThrowProficiencies) ? value.savingThrowProficiencies : [],
    skillProficiencies: Array.isArray(value.skillProficiencies) ? value.skillProficiencies : [],
    skillExpertise: Array.isArray(value.skillExpertise) ? value.skillExpertise : [],
    classSkillChoices: Array.isArray(value.classSkillChoices) ? value.classSkillChoices : [],
    languages: Array.isArray(value.languages) ? value.languages : [],
    toolProficiencies: Array.isArray(value.toolProficiencies) ? value.toolProficiencies : [],
    armorProficiencies: Array.isArray(value.armorProficiencies) ? value.armorProficiencies : [],
    weaponProficiencies: Array.isArray(value.weaponProficiencies) ? value.weaponProficiencies : [],
    weaponMasteries: Array.isArray(value.weaponMasteries) ? value.weaponMasteries : [],
    advancementChoices: Array.isArray(value.advancementChoices) ? value.advancementChoices.filter((choice) => choice && typeof choice.featureName === "string" && Array.isArray(choice.selections)) : [],
    advancementHistory: Array.isArray(value.advancementHistory) ? value.advancementHistory.filter((entry) => entry && typeof entry.id === "string" && entry.before && typeof entry.before === "object") : [],
    abilityScoresConfirmed: Boolean(value.abilityScoresConfirmed),
    startingEquipmentConfirmed: Boolean(value.startingEquipmentConfirmed),
    startingEquipmentChoice: value.startingEquipmentChoice === "A" || value.startingEquipmentChoice === "B" ? value.startingEquipmentChoice : "",
    startingGold: Math.max(0, Number(value.startingGold) || 0),
    attacks: Array.isArray(value.attacks) ? value.attacks.map((attack) => ({ ...attack, damageBonus: Number(attack.damageBonus) || 0 })) : [],
    feats: Array.isArray(value.feats) ? value.feats : [],
    spells: Array.isArray(value.spells) ? value.spells : [],
    spellSlots: value.spellSlots && typeof value.spellSlots === "object" ? value.spellSlots : {},
    concentratingSpellId: typeof value.concentratingSpellId === "string" ? value.concentratingSpellId : undefined,
    activeEffects: Array.isArray(value.activeEffects) ? value.activeEffects.filter((effect) => effect && typeof effect.name === "string").map((effect) => ({
      ...effect,
      id: typeof effect.id === "string" && effect.id ? effect.id : crypto.randomUUID(),
      source: typeof effect.source === "string" ? effect.source : "Manual",
      duration: (["rounds", "minutes", "until-rest", "manual"] as const).includes(effect.duration) ? effect.duration : "manual",
      remaining: effect.remaining === undefined ? undefined : Math.max(0, Number(effect.remaining) || 0),
      concentration: Boolean(effect.concentration),
      condition: typeof effect.condition === "string" ? effect.condition : undefined,
    })) : [],
    companions: Array.isArray(value.companions) ? value.companions.filter((item) => item && typeof item.name === "string").map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
      contentId: typeof item.contentId === "string" ? item.contentId : undefined,
      name: item.name.trim() || "Companion",
      kind: (["companion", "summon", "form"] as const).includes(item.kind) ? item.kind : "companion",
      active: item.active !== false,
      currentHp: Math.max(0, Number(item.currentHp) || 0),
      maxHp: Math.max(1, Number(item.maxHp) || 1),
      armorClass: Math.max(0, Number(item.armorClass) || 10),
      speed: typeof item.speed === "string" ? item.speed : "30 ft.",
      challengeRating: typeof item.challengeRating === "string" ? item.challengeRating : undefined,
      description: typeof item.description === "string" ? item.description : "",
      notes: typeof item.notes === "string" ? item.notes : "",
      source: typeof item.source === "string" ? item.source : undefined,
    })) : [],
    inventory: Array.isArray(value.inventory) ? value.inventory.map((item) => ({
      ...item,
      charges: item.charges === undefined ? undefined : Math.max(0, Number(item.charges) || 0),
      maximumCharges: item.maximumCharges === undefined ? undefined : Math.max(0, Number(item.maximumCharges) || 0),
      ammunition: item.ammunition === undefined ? undefined : Math.max(0, Number(item.ammunition) || 0),
      consumable: Boolean(item.consumable),
      attuned: Boolean(item.attuned),
      container: typeof item.container === "string" ? item.container : "",
      equipmentSlot: (["none", "main-hand", "off-hand", "two-hands", "armor", "worn"] as const).includes(item.equipmentSlot ?? "none") ? item.equipmentSlot : "none",
    })) : [],
    currency: { ...defaults.currency, ...(value.currency ?? {}) },
    resources: Array.isArray(value.resources)
      ? value.resources.filter((resource) => resource && typeof resource.name === "string").map((resource) => {
          const maximum = Math.max(0, Number(resource.maximum) || 0);
          return {
            id: typeof resource.id === "string" && resource.id ? resource.id : crypto.randomUUID(),
            name: resource.name.trim() || "Class resource",
            current: Math.max(0, Math.min(maximum, Number(resource.current) || 0)),
            maximum,
            recovery: (["short", "short-one", "long", "manual"] as const).includes(resource.recovery) ? resource.recovery : "long",
            automatic: Boolean(resource.automatic),
            source: typeof resource.source === "string" ? resource.source : undefined,
          };
        })
      : [],
    inspiration: Boolean(value.inspiration),
    hitDiceTotal: maximumHitDice,
    hitDiceUsed: Math.max(0, Math.min(maximumHitDice, Number(value.hitDiceUsed ?? 0))),
    hitDiceByClass: Array.isArray(value.hitDiceByClass) && value.hitDiceByClass.length ? value.hitDiceByClass.map((pool) => ({ className: pool.className, die: Math.max(0, Number(pool.die) || 0), total: Math.max(1, Number(pool.total) || 1), used: Math.max(0, Math.min(Number(pool.total) || 1, Number(pool.used) || 0)) })) : classLevels.map((entry, index) => ({ className: entry.className, die: 0, total: entry.level, used: index === 0 ? Math.max(0, Math.min(entry.level, Number(value.hitDiceUsed ?? 0))) : 0 })),
    deathSaveSuccesses: Math.max(0, Math.min(3, Number(value.deathSaveSuccesses ?? 0))),
    deathSaveFailures: Math.max(0, Math.min(3, Number(value.deathSaveFailures ?? 0))),
    conditions: Array.isArray(value.conditions) ? value.conditions : [],
    exhaustionLevel: Math.max(0, Math.min(6, Number(value.exhaustionLevel ?? (value.conditions?.includes("Exhaustion") ? 1 : 0)))),
    damageResistances: Array.isArray(value.damageResistances) ? value.damageResistances : [],
    damageVulnerabilities: Array.isArray(value.damageVulnerabilities) ? value.damageVulnerabilities : [],
    damageImmunities: Array.isArray(value.damageImmunities) ? value.damageImmunities : [],
    conditionImmunities: Array.isArray(value.conditionImmunities) ? value.conditionImmunities : [],
    savingThrowBonuses: value.savingThrowBonuses && typeof value.savingThrowBonuses === "object" ? value.savingThrowBonuses : {},
    journal: Array.isArray(value.journal) ? value.journal.filter((entry) => entry && typeof entry.title === "string").map((entry) => ({
      id: typeof entry.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
      type: (["session", "quest", "npc", "location", "lore"] as const).includes(entry.type) ? entry.type : "session",
      title: entry.title.trim() || "Untitled entry",
      details: typeof entry.details === "string" ? entry.details : "",
      status: (["active", "completed", "archived"] as const).includes(entry.status) ? entry.status : "active",
      pinned: Boolean(entry.pinned),
      createdAt: typeof entry.createdAt === "string" ? entry.createdAt : new Date().toISOString(),
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : new Date().toISOString(),
    })) : [],
  };
  const training = classTrainingFor(normalized.className);
  if (!normalized.armorProficiencies.length) normalized.armorProficiencies = training.armor;
  if (!normalized.weaponProficiencies.length) normalized.weaponProficiencies = training.weapons;
  const progressionSlots = syncMulticlassSpellSlots(normalized.spellSlots, normalized.classLevels);
  return {
    ...normalized,
    ...(progressionSlots ? { spellSlots: progressionSlots } : {}),
    resources: syncMulticlassResources(normalized.resources, normalized.classLevels, normalized.abilities),
  };
}

export function migrateOfflineStore(value: unknown): OfflineStore {
  const parsed = value && typeof value === "object"
    ? value as { version?: unknown; characters?: unknown; packs?: unknown; disabledPackIds?: unknown; recovery?: unknown }
    : {};
  const sourceVersion = Number.isInteger(parsed.version) ? Number(parsed.version) : 1;
  if (sourceVersion > CURRENT_STORE_VERSION) throw new Error("This character library was created by a newer version of Azeroth Archives.");

  let migrated = {
    version: Math.max(1, sourceVersion),
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    packs: Array.isArray(parsed.packs) ? parsed.packs : [],
    disabledPackIds: Array.isArray(parsed.disabledPackIds) ? parsed.disabledPackIds.filter((id): id is string => typeof id === "string") : [],
  };
  if (migrated.version === 1) migrated = { ...migrated, version: 2, packs: Array.isArray(migrated.packs) ? migrated.packs : [] };
  if (migrated.version === 2) migrated = { ...migrated, version: 3 };
  if (migrated.version === 3) migrated = { ...migrated, version: 4, disabledPackIds: [] };

  const characters = Array.isArray(migrated.characters)
    ? migrated.characters.filter((item): item is Partial<CharacterData> => Boolean(item) && typeof item === "object").map(normalizeCharacter)
    : [];
  const packs = Array.isArray(migrated.packs)
    ? migrated.packs.filter((pack): pack is ContentPack => contentPackValidationError(pack) === null)
    : [];
  const recoverySource = parsed.recovery && typeof parsed.recovery === "object"
    ? parsed.recovery as { restoredFrom?: unknown; migrationBackup?: unknown }
    : undefined;
  const recovery = recoverySource
    ? {
        ...(typeof recoverySource.restoredFrom === "string" ? { restoredFrom: recoverySource.restoredFrom } : {}),
        ...(typeof recoverySource.migrationBackup === "string" ? { migrationBackup: recoverySource.migrationBackup } : {}),
      }
    : undefined;
  return { version: CURRENT_STORE_VERSION, characters, packs, disabledPackIds: migrated.disabledPackIds, ...(recovery ? { recovery } : {}) };
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function modifierLabel(score: number) {
  const modifier = abilityModifier(score);
  return `${modifier >= 0 ? "+" : ""}${modifier}`;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function featureIdentity(feature: RulesFeature) {
  return feature.id ? `id:${feature.id}` : `name:${feature.name}`;
}

function ancestryDescription(ancestry: AncestryDefinition) {
  return ancestry.traits.map((trait) => `${trait.name}\n${trait.description}`).join("\n\n");
}

function classDescription(definition: ClassDefinition) {
  const details = `Hit Die: d${definition.hitDie}\nPrimary ability: ${ABILITY_LABELS[definition.primaryAbility]}`;
  return [details, definition.description].filter(Boolean).join("\n\n");
}

function backgroundDescription(background: BackgroundDefinition) {
  return [
    background.skills.length ? `Skills: ${background.skills.join(", ")}` : "",
    background.abilityOptions?.length ? `Abilities: ${background.abilityOptions.map((ability) => ABILITY_LABELS[ability]).join(", ")}` : "",
    background.featId ? `Feat: ${background.featId.replaceAll("-", " ")}` : "",
    background.toolProficiencies?.length ? `Tools: ${background.toolProficiencies.join(", ")}` : "",
    background.equipment ? `Equipment: ${background.equipment}` : "",
    background.feature?.description,
  ].filter(Boolean).join("\n\n");
}

function advancementSnapshot(character: CharacterData): AdvancementSnapshot {
  return structuredClone({
    level: character.level, className: character.className, subclassName: character.subclassName, classLevels: character.classLevels,
    experience: character.experience, currentHp: character.currentHp, maxHp: character.maxHp, proficiencyBonus: character.proficiencyBonus,
    hitDiceTotal: character.hitDiceTotal, hitDiceUsed: character.hitDiceUsed, hitDiceByClass: character.hitDiceByClass, abilities: character.abilities,
    skillProficiencies: character.skillProficiencies, skillExpertise: character.skillExpertise, weaponMasteries: character.weaponMasteries,
    advancementChoices: character.advancementChoices, resources: character.resources, spellSlots: character.spellSlots,
    feats: character.feats, spells: character.spells, features: character.features,
  });
}

export function CharacterManager() {
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [character, setCharacter] = useState<CharacterData>(newCharacter);
  const [customPacks, setCustomPacks] = useState<ContentPack[]>([]);
  const [disabledPackIds, setDisabledPackIds] = useState<string[]>([]);
  const [tab, setTab] = useState<Tab>("overview");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading your roster…");
  const [saving, setSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [menuCharacterId, setMenuCharacterId] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpHpGain, setLevelUpHpGain] = useState(1);
  const [levelUpChoice, setLevelUpChoice] = useState<"abilities" | "feat">("abilities");
  const [levelUpAbilities, setLevelUpAbilities] = useState<[AbilityKey, AbilityKey]>(["strength", "stamina"]);
  const [levelUpFeatId, setLevelUpFeatId] = useState("");
  const [levelUpSelections, setLevelUpSelections] = useState<Record<string, string[]>>({});
  const [levelUpClassName, setLevelUpClassName] = useState("");
  const [levelUpSubclassName, setLevelUpSubclassName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CharacterData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const characterFileInput = useRef<HTMLInputElement>(null);
  const fullBackupFileInput = useRef<HTMLInputElement>(null);
  const portraitFileInput = useRef<HTMLInputElement>(null);
  const characterRef = useRef(character);
  const deletedCharacterIds = useRef(new Set<string>());
  characterRef.current = character;

  const content = useMemo(() => customPacks.filter((pack) => pack.pack.id === bundledPackId || !disabledPackIds.includes(pack.pack.id)), [customPacks, disabledPackIds]);
  const ancestries = useMemo(() => uniqueById(content.flatMap((pack) => pack.ancestries ?? [])), [content]);
  const classes = useMemo(() => uniqueById(content.flatMap((pack) => pack.classes ?? [])), [content]);
  const backgrounds = useMemo(() => uniqueById(content.flatMap((pack) => pack.backgrounds ?? [])), [content]);
  const feats = useMemo(() => uniqueById(content.flatMap((pack) => pack.feats ?? [])), [content]);
  const equipment = useMemo(() => uniqueById(content.flatMap((pack) => pack.equipment ?? [])), [content]);
  const spells = useMemo(() => uniqueById(content.flatMap((pack) => pack.spells ?? [])), [content]);
  const creatures = useMemo(() => uniqueById(content.flatMap((pack) => pack.creatures ?? [])), [content]);
  const featureCatalogById = useMemo(() => new Map(
    [
      ...ancestries.flatMap((item) => item.traits),
      ...classes.flatMap((item) => [
        ...Object.values(item.levelFeatures).flat(),
        ...(item.subclasses ?? []).flatMap((subclass) => Object.values(subclass.levelFeatures).flat()),
      ]),
      ...backgrounds.flatMap((item) => item.feature ? [item.feature] : []),
    ].filter((feature) => feature.id).map((feature) => [feature.id!, feature]),
  ), [ancestries, classes, backgrounds]);
  const resolvedFeatures = useMemo(
    () => character.features.map((feature) => feature.id ? featureCatalogById.get(feature.id) ?? feature : feature),
    [character.features, featureCatalogById],
  );
  const selectedAncestry = useMemo(
    () => ancestries.find((item) => item.name === character.ancestry),
    [ancestries, character.ancestry],
  );
  const selectedClass = useMemo(
    () => classes.find((item) => item.name === character.className),
    [classes, character.className],
  );
  const selectedBackground = useMemo(
    () => backgrounds.find((item) => item.name === character.background),
    [backgrounds, character.background],
  );
  const subclasses = selectedClass?.subclasses ?? [];
  const visibleCharacters = characters.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()));
  const nextLevelXp = character.level * 1000;
  const xpProgress = Math.min(100, Math.round((character.experience / nextLevelXp) * 100));
  const plannedLevel = Math.min(20, character.level + 1);
  const selectedSubclass = selectedClass?.subclasses?.find((item) => item.name === character.subclassName);
  const selectedLevelUpClass = classes.find((item) => item.name === (levelUpClassName || character.className));
  const currentLevelUpEntry = character.classLevels.find((entry) => entry.className === selectedLevelUpClass?.name);
  const plannedClassLevel = Math.min(20, (currentLevelUpEntry?.level ?? 0) + 1);
  const selectedLevelUpSubclass = selectedLevelUpClass?.subclasses?.find((item) => item.name === (levelUpSubclassName || currentLevelUpEntry?.subclassName));
  const activeFeatureOrigins = useMemo(() => {
    const origins = new Map<string, string>();
    const record = (features: RulesFeature[], label: string) => features.forEach((feature) => origins.set(featureIdentity(feature), label));
    if (selectedAncestry) record(selectedAncestry.traits, `${selectedAncestry.name} ancestry`);
    for (const entry of character.classLevels) {
      const definition = classes.find((item) => item.name === entry.className);
      if (definition) record(Object.values(definition.levelFeatures).flat(), `${definition.name} class`);
      const specialization = definition?.subclasses?.find((item) => item.name === entry.subclassName);
      if (specialization) record(Object.values(specialization.levelFeatures).flat(), `${specialization.name} subclass`);
    }
    if (selectedBackground?.feature) record([selectedBackground.feature], `${selectedBackground.name} background`);
    return origins;
  }, [selectedAncestry, selectedBackground, classes, character.classLevels]);
  const featureOrigin = (feature: RulesFeature) => activeFeatureOrigins.get(featureIdentity(feature));
  const plannedClassFeatures = selectedLevelUpClass?.levelFeatures[String(plannedClassLevel)] ?? [];
  const plannedSubclassFeatures = selectedLevelUpSubclass?.levelFeatures[String(plannedClassLevel)] ?? [];
  const plannedFeatures = [...plannedClassFeatures, ...plannedSubclassFeatures];
  const advancementPrompts = useMemo(() => advancementPromptsForFeatures(plannedFeatures, selectedLevelUpClass?.name ?? character.className), [plannedFeatures, selectedLevelUpClass?.name, character.className]);
  const hasAdvancementChoice = plannedFeatures.some((feature) => /Ability Score Improvement/i.test(feature.name));
  const needsSubclass = !selectedLevelUpSubclass && Boolean(selectedLevelUpClass?.subclasses?.some((item) => (item.levelFeatures[String(plannedClassLevel)] ?? []).length));
  const advancementChoicesComplete = advancementPrompts.every((prompt) => {
    const selections = levelUpSelections[prompt.id] ?? [];
    return selections.length === prompt.count && selections.every(Boolean) && new Set(selections).size === selections.length;
  });
  const hitDicePools = useMemo(() => character.classLevels.map((entry, index) => {
    const stored = character.hitDiceByClass.find((pool) => pool.className === entry.className);
    return { className: entry.className, die: stored?.die || classes.find((definition) => definition.name === entry.className)?.hitDie || 8, total: stored?.total ?? entry.level, used: stored?.used ?? (index === 0 ? character.hitDiceUsed : 0) };
  }), [character.classLevels, character.hitDiceByClass, character.hitDiceUsed, classes]);
  const encumbrance = useMemo(() => calculateEncumbrance(character.inventory, character.abilities.strength), [character.inventory, character.abilities.strength]);
  const effectiveArmor = useMemo(() => calculateArmorClass(character, equipment), [character, equipment]);
  const effectiveSpeed = useMemo(() => calculateEffectiveSpeed(character, encumbrance, equipment), [character, encumbrance, equipment]);
  const spellcastingAbility = character.classLevels.map((entry) => spellcastingAbilityForClass(entry.className, entry.subclassName ?? "", classes.find((definition) => definition.name === entry.className)?.primaryAbility)).find((ability): ability is AbilityKey => Boolean(ability)) ?? null;
  useEffect(() => {
    const load = window.azerothDesktop?.load() ?? Promise.resolve(readBrowserStore());
    load.then((store) => {
      const loadedCharacters = store.characters.map((item) => normalizeCharacter(item));
      setCharacters(loadedCharacters);
      if (loadedCharacters[0]) setCharacter(loadedCharacters[0]);
      setCustomPacks(withBundledPack(store.packs));
      setDisabledPackIds(store.disabledPackIds ?? []);
      if (store.recovery?.restoredFrom) setStatus(`Recovered data from automatic backup ${store.recovery.restoredFrom}`);
      else if (store.recovery?.migrationBackup) setStatus(`Character data updated safely; backup saved as ${store.recovery.migrationBackup}`);
      else setStatus(store.characters.length ? "Saved on this device" : "Create your first hero");
    }).catch(() => setStatus("Could not read local character data"));
  }, []);

  useEffect(() => {
    if (character.id === "draft") return;
    setCharacters((current) => current.map((item) => item.id === character.id ? character : item));
  }, [character]);

  useEffect(() => {
    if (character.id === "draft" || status !== "Unsaved changes") return;
    const payload = character;
    const timer = window.setTimeout(() => {
      persistCharacter(payload).then(async (saved) => {
        if (deletedCharacterIds.current.has(saved.id)) {
          if (window.azerothDesktop) await window.azerothDesktop.deleteCharacter(saved.id);
          return;
        }
        setCharacters((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
        if (characterRef.current.id === payload.id && characterRef.current.updatedAt === payload.updatedAt) {
          setCharacter(saved);
          setStatus("Autosaved on this device");
        }
      }).catch(() => setStatus("Autosave failed — use Save character"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [character, status]);

  function patchCharacter(patch: Partial<CharacterData>) {
    setCharacter((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    setStatus("Unsaved changes");
  }

  async function choosePortrait(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      patchCharacter({ portraitDataUrl: await resizePortrait(file) });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Portrait could not be added");
    }
  }

  function updateAbility(key: AbilityKey, value: number) {
    const score = Math.max(1, Math.min(30, value || 1));
    if (character.level === 1 && !character.abilityScoresConfirmed) {
      const baseAbilities = { ...character.baseAbilities, [key]: score };
      const abilities = Object.fromEntries(abilityKeys.map((ability) => [ability, baseAbilities[ability] + (character.backgroundAbilityBonuses[ability] ?? 0)])) as CharacterData["abilities"];
      patchCharacter({ baseAbilities, abilities, abilityScoreMethod: "manual", resources: syncMulticlassResources(character.resources, character.classLevels, abilities) });
      return;
    }
    const abilities = { ...character.abilities, [key]: score };
    patchCharacter({ abilities, resources: syncMulticlassResources(character.resources, character.classLevels, abilities) });
  }

  function applyAncestry(name: string) {
    const ancestry = ancestries.find((item) => item.name === name);
    patchCharacter({
      ancestry: name,
      speed: ancestry?.speed ?? character.speed,
      features: [
        ...(ancestry?.traits ?? []),
        ...character.features.filter((feature) => !ancestries.some((item) => item.traits.some((trait) => trait.name === feature.name))),
      ],
    });
  }

  function applyClass(name: string) {
    const selectedClass = classes.find((item) => item.name === name);
    const classLevels = name ? [{ className: name, subclassName: "", level: character.level }] : [];
    const training = classTrainingFor(name);
    const classFeatureNames = new Set(classes.flatMap((item) => Object.values(item.levelFeatures).flat().map((feature) => feature.name)));
    const subclassFeatureNames = new Set(classes.flatMap((item) => (item.subclasses ?? []).flatMap((subclass) => Object.values(subclass.levelFeatures).flat().map((feature) => feature.name))));
    const progressionSlots = syncProgressionSpellSlots(character.spellSlots, name, "", character.level);
    const startingHp = selectedClass && character.level === 1 ? Math.max(1, selectedClass.hitDie + abilityModifier(character.abilities.stamina)) : null;
    const retainedSkills = [...new Set([...character.skillProficiencies.filter((skill) => !character.classSkillChoices.includes(skill)), ...(selectedBackground?.skills ?? [])])];
    const fightingStyleIds = new Set(feats.filter((feat) => feat.category.toLowerCase() === "fighting style").map((feat) => feat.id));
    patchCharacter({
      className: name,
      subclassName: "",
      classLevels,
      advancementHistory: [],
      hitDiceByClass: selectedClass ? [{ className: name, die: selectedClass.hitDie, total: character.level, used: Math.min(character.hitDiceUsed, character.level) }] : [],
      savingThrowProficiencies: selectedClass?.savingThrowProficiencies ?? character.savingThrowProficiencies,
      classSkillChoices: [],
      skillProficiencies: retainedSkills,
      armorProficiencies: training.armor,
      weaponProficiencies: training.weapons,
      weaponMasteries: [],
      advancementChoices: character.advancementChoices.filter((choice) => choice.kind === "other"),
      feats: character.feats.filter((feat) => !fightingStyleIds.has(feat.id)),
      features: [
        ...character.features.filter((feature) => !classFeatureNames.has(feature.name) && !subclassFeatureNames.has(feature.name)),
        ...Object.entries(selectedClass?.levelFeatures ?? {})
          .filter(([level]) => Number(level) <= character.level)
          .flatMap(([, features]) => features),
      ],
      spellSlots: progressionSlots ?? {},
      resources: syncMulticlassResources(character.resources, classLevels, character.abilities),
      ...(startingHp !== null ? { maxHp: startingHp, currentHp: startingHp, hitDiceTotal: 1, hitDiceUsed: 0 } : {}),
    });
  }

  function applySubclass(name: string) {
    const selectedSubclass = subclasses.find((item) => item.name === name);
    const subclassFeatureNames = new Set(classes.flatMap((item) => (item.subclasses ?? []).flatMap((subclass) => Object.values(subclass.levelFeatures).flat().map((feature) => feature.name))));
    const classLevels = character.classLevels.map((entry, index) => index === 0 || entry.className === character.className ? { ...entry, subclassName: name } : entry);
    const primaryClassLevel = classLevels.find((entry) => entry.className === character.className)?.level ?? character.level;
    const progressionSlots = syncMulticlassSpellSlots(character.spellSlots, classLevels);
    patchCharacter({
      subclassName: name,
      classLevels,
      features: [
        ...character.features.filter((feature) => !subclassFeatureNames.has(feature.name)),
        ...Object.entries(selectedSubclass?.levelFeatures ?? {})
          .filter(([level]) => Number(level) <= primaryClassLevel)
          .flatMap(([, features]) => features),
      ],
      ...(progressionSlots ? { spellSlots: progressionSlots } : {}),
    });
  }

  function applyBackground(name: string) {
    const selectedBackground = backgrounds.find((item) => item.name === name);
    const previousBackground = backgrounds.find((item) => item.name === character.background);
    const backgroundFeatureNames = new Set(backgrounds.flatMap((item) => item.feature ? [item.feature.name] : []));
    const previousBackgroundSkills = new Set(previousBackground?.skills ?? []);
    const skillProficiencies = [
      ...character.skillProficiencies.filter((skill) => !previousBackgroundSkills.has(skill)),
      ...character.classSkillChoices,
      ...(selectedBackground?.skills ?? []),
    ];
    const previousTools = new Set(previousBackground?.toolProficiencies ?? []);
    const toolProficiencies = [...character.toolProficiencies.filter((tool) => !previousTools.has(tool)), ...(selectedBackground?.toolProficiencies ?? [])];
    const selectedFeat = selectedBackground?.featId ? feats.find((feat) => feat.id === selectedBackground.featId) : undefined;
    const resetCreationAbilities = character.level === 1 && !character.abilityScoresConfirmed;
    const inventory = character.inventory.filter((item) => item.source !== "Starting equipment");
    const currency = { ...character.currency, gold: Math.max(0, character.currency.gold - character.startingGold) };
    patchCharacter({
      background: name,
      skillProficiencies: [...new Set(skillProficiencies)],
      skillExpertise: character.skillExpertise.filter((skill) => skillProficiencies.includes(skill)),
      toolProficiencies: [...new Set(toolProficiencies)],
      startingEquipmentConfirmed: false,
      startingEquipmentChoice: "",
      startingGold: 0,
      inventory,
      currency,
      ...(resetCreationAbilities ? { backgroundAbilityBonuses: {}, abilities: { ...character.baseAbilities } } : {}),
      feats: [...character.feats.filter((feat) => feat.id !== previousBackground?.featId), ...(selectedFeat && !character.feats.some((feat) => feat.id === selectedFeat.id) ? [selectedFeat] : [])],
      features: [
        ...character.features.filter((feature) => !backgroundFeatureNames.has(feature.name)),
        ...(selectedBackground?.feature ? [selectedBackground.feature] : []),
      ],
    });
  }

  async function persistCharacter(payload: CharacterData) {
    if (window.azerothDesktop) return window.azerothDesktop.saveCharacter(payload);
    const saved = { ...payload, updatedAt: new Date().toISOString() };
    const store = readBrowserStore();
    store.characters = [saved, ...store.characters.filter((item) => item.id !== saved.id)];
    writeBrowserStore(store);
    return saved;
  }

  async function saveCharacter() {
    setSaving(true);
    setStatus("Saving…");
    const payload = { ...character, id: character.id === "draft" ? crypto.randomUUID() : character.id };
    try {
      const saved = await persistCharacter(payload);
      setCharacter(saved);
      setCharacters((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setStatus("Saved on this device");
    } catch {
      setStatus("Could not save — try again");
    } finally {
      setSaving(false);
    }
  }

  function deleteCharacter(target: CharacterData) {
    setMenuCharacterId(null);
    setDeleteTarget(target);
  }

  async function confirmDeleteCharacter() {
    const target = deleteTarget;
    if (!target) return;
    setDeleteTarget(null);
    if (target.id === "draft") {
      setCharacter(newCharacter());
      return;
    }
    deletedCharacterIds.current.add(target.id);
    if (window.azerothDesktop) {
      await window.azerothDesktop.deleteCharacter(target.id);
    } else {
      const store = readBrowserStore();
      store.characters = store.characters.filter((item) => item.id !== target.id);
      writeBrowserStore(store);
    }
    const remaining = characters.filter((item) => item.id !== target.id);
    setCharacters(remaining);
    if (character.id === target.id) setCharacter(remaining[0] ?? newCharacter());
    setStatus("Character removed");
  }

  async function duplicateCharacter(source: CharacterData) {
    const now = new Date().toISOString();
    const duplicate = normalizeCharacter({
      ...source,
      id: crypto.randomUUID(),
      name: `${source.name} Copy`,
      createdAt: now,
      updatedAt: now,
    });
    const saved = await persistCharacter(duplicate);
    setCharacters((current) => [saved, ...current]);
    setCharacter(saved);
    setMenuCharacterId(null);
    setShowRoster(false);
    setStatus("Character duplicated");
  }

  async function exportCharacter(source: CharacterData) {
    const backup = JSON.stringify({ format: "azeroth-archives-character", version: 1, character: source }, null, 2);
    const safeName = source.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "character";
    const filename = `${safeName}.azeroth-character.json`;
    if (window.azerothDesktop) {
      const destination = await window.azerothDesktop.saveJson(filename, backup);
      setStatus(destination ? "Character backup saved" : "Backup export canceled");
    } else {
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      setStatus("Character backup downloaded");
    }
    setMenuCharacterId(null);
  }

  async function exportFullBackup() {
    try {
      const store = window.azerothDesktop ? await window.azerothDesktop.load() : readBrowserStore();
      const backup = JSON.stringify({
        format: "azeroth-archives-full-backup",
        version: CURRENT_STORE_VERSION,
        exportedAt: new Date().toISOString(),
        store: { version: CURRENT_STORE_VERSION, characters: store.characters, packs: store.packs, disabledPackIds: store.disabledPackIds ?? [] },
      }, null, 2);
      const filename = `azeroth-archives-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (window.azerothDesktop) {
        const destination = await window.azerothDesktop.saveJson(filename, backup);
        setStatus(destination ? "Full backup saved" : "Full backup canceled");
      } else {
        const anchor = document.createElement("a");
        anchor.href = URL.createObjectURL(new Blob([backup], { type: "application/json" }));
        anchor.download = filename;
        anchor.click();
        URL.revokeObjectURL(anchor.href);
        setStatus("Full backup downloaded");
      }
    } catch {
      setStatus("Could not create a full backup");
    }
  }

  async function importFullBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; store?: unknown };
      if (parsed.format !== "azeroth-archives-full-backup" || !parsed.store || typeof parsed.store !== "object") throw new Error("Invalid full backup");
      const source = parsed.store as { characters?: unknown; packs?: unknown };
      if (!Array.isArray(source.characters) || !Array.isArray(source.packs)) throw new Error("Invalid full backup contents");
      source.packs.forEach(assertContentPack);
      const restored = migrateOfflineStore(source);
      if (!window.confirm(`Restore ${restored.characters.length} character${restored.characters.length === 1 ? "" : "s"} and ${restored.packs.length} imported content pack${restored.packs.length === 1 ? "" : "s"}? This replaces the current local library.`)) {
        setStatus("Full backup restore canceled");
        return;
      }
      const saved = window.azerothDesktop ? await window.azerothDesktop.replaceStore(restored) : (writeBrowserStore(restored), restored);
      const loadedCharacters = saved.characters.map(normalizeCharacter);
      setCharacters(loadedCharacters);
      setCharacter(loadedCharacters[0] ?? newCharacter());
      setCustomPacks(withBundledPack(saved.packs));
      setDisabledPackIds(saved.disabledPackIds ?? []);
      setShowRoster(false);
      setStatus(`Full backup restored: ${loadedCharacters.length} character${loadedCharacters.length === 1 ? "" : "s"}`);
    } catch {
      setStatus("That file is not a valid full backup");
    }
  }

  async function importCharacter(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; character?: Partial<CharacterData> } & Partial<CharacterData>;
      const source = parsed.character ?? parsed;
      if (typeof source.name !== "string" || !source.name.trim() || !source.abilities || typeof source.abilities !== "object") throw new Error("Invalid character");
      const now = new Date().toISOString();
      const imported = normalizeCharacter({ ...source, id: crypto.randomUUID(), createdAt: now, updatedAt: now });
      const saved = await persistCharacter(imported);
      setCharacters((current) => [saved, ...current]);
      setCharacter(saved);
      setShowRoster(false);
      setStatus("Character imported as a new copy");
    } catch {
      setStatus("That file is not a valid character backup");
    }
  }

  function levelUp() {
    if (character.level >= 20 || !selectedClass) {
      if (!selectedClass) setStatus("Choose a class before leveling up");
      return;
    }
    const entry = character.classLevels.find((item) => item.className === selectedClass.name);
    const nextClassLevel = (entry?.level ?? 0) + 1;
    const specialization = selectedClass.subclasses?.find((item) => item.name === entry?.subclassName);
    const features = [...(selectedClass.levelFeatures[String(nextClassLevel)] ?? []), ...(specialization?.levelFeatures[String(nextClassLevel)] ?? [])];
    const prompts = advancementPromptsForFeatures(features, selectedClass.name);
    const staminaBonus = abilityModifier(character.abilities.stamina);
    setLevelUpHpGain(Math.max(1, Math.floor(selectedClass.hitDie / 2) + 1 + staminaBonus));
    setLevelUpChoice("abilities");
    setLevelUpAbilities([selectedClass.primaryAbility, "stamina"]);
    setLevelUpFeatId("");
    setLevelUpClassName(selectedClass.name);
    setLevelUpSubclassName(entry?.subclassName ?? "");
    setLevelUpSelections(Object.fromEntries(prompts.map((prompt) => {
      const saved = character.advancementChoices.find((choice) => choice.featureId === prompt.featureId && choice.level === character.level + 1 && choice.kind === prompt.kind);
      return [prompt.id, saved?.selections ?? Array.from({ length: prompt.count }, () => "")];
    })));
    setShowLevelUp(true);
  }

  function changeLevelUpClass(name: string) {
    const definition = classes.find((item) => item.name === name);
    if (!definition) return;
    const entry = character.classLevels.find((item) => item.className === name);
    setLevelUpClassName(name);
    setLevelUpSubclassName(entry?.subclassName ?? "");
    setLevelUpAbilities([definition.primaryAbility, "stamina"]);
    setLevelUpSelections({});
    setLevelUpFeatId("");
    setLevelUpHpGain(Math.max(1, Math.floor(definition.hitDie / 2) + 1 + abilityModifier(character.abilities.stamina)));
  }

  function advancementOptions(prompt: (typeof advancementPrompts)[number]) {
    if (prompt.kind === "skill") return SKILLS.map((skill) => ({ value: skill.name, label: skill.name }));
    if (prompt.kind === "expertise") return character.skillProficiencies.filter((skill) => !character.skillExpertise.includes(skill)).map((skill) => ({ value: skill, label: skill }));
    if (prompt.kind === "weapon-mastery") return equipment.filter((item) => Boolean(item.damage) && isEquipmentProficient(character, item)).map((item) => ({ value: item.name, label: `${item.name}${item.mastery ? ` — ${item.mastery}` : ""}` }));
    if (prompt.kind === "fighting-style") return feats.filter((feat) => feat.category.toLowerCase() === "fighting style" && !character.feats.some((known) => known.id === feat.id)).map((feat) => ({ value: feat.id, label: feat.name }));
    if (prompt.kind === "metamagic") return METAMAGIC_OPTIONS.map((option) => ({ value: option, label: option }));
    if (prompt.kind === "spell") {
      const feature = plannedFeatures.find((item) => item.id === prompt.featureId || item.name === prompt.featureName);
      const allLists = /can come from|spell list or any combination/i.test(feature?.description ?? "");
      const targetClassName = selectedLevelUpClass?.name ?? character.className;
      const maxSpellLevel = Math.max(0, ...Object.entries(progressionSpellSlots(targetClassName, selectedLevelUpSubclass?.name ?? "", plannedClassLevel) ?? {}).filter(([, maximum]) => maximum > 0).map(([level]) => Number(level)));
      return spells.filter((spell) => (allLists || spell.classes.some((className) => className.toLowerCase() === targetClassName.toLowerCase())) && (prompt.label === "Cantrip" ? spell.level === 0 : spell.level <= maxSpellLevel) && !character.spells.some((known) => known.id === spell.id)).map((spell) => ({ value: spell.id, label: `${spell.name}${spell.level ? ` (Level ${spell.level})` : " (Cantrip)"}` }));
    }
    return [];
  }

  function setAdvancementSelection(promptId: string, index: number, value: string) {
    setLevelUpSelections((current) => {
      const selections = [...(current[promptId] ?? [])];
      selections[index] = value;
      return { ...current, [promptId]: selections };
    });
  }

  function confirmLevelUp() {
    if (character.level >= 20 || !selectedLevelUpClass || needsSubclass || !advancementChoicesComplete) return;
    const nextLevel = character.level + 1;
    const newFeatures = selectedLevelUpClass.levelFeatures[String(plannedClassLevel)] ?? [];
    const newSubclassFeatures = selectedLevelUpSubclass?.levelFeatures[String(plannedClassLevel)] ?? [];
    const classLevels = currentLevelUpEntry
      ? character.classLevels.map((entry) => entry.className === selectedLevelUpClass.name ? { ...entry, level: plannedClassLevel, subclassName: selectedLevelUpSubclass?.name ?? entry.subclassName ?? "" } : entry)
      : [...character.classLevels, { className: selectedLevelUpClass.name, subclassName: selectedLevelUpSubclass?.name ?? "", level: 1 }];
    const abilities = { ...character.abilities };
    if (hasAdvancementChoice && levelUpChoice === "abilities") {
      for (const ability of levelUpAbilities) abilities[ability] = Math.min(20, abilities[ability] + 1);
    }
    const selectedFeat = hasAdvancementChoice && levelUpChoice === "feat" ? feats.find((feat) => feat.id === levelUpFeatId) : undefined;
    if (hasAdvancementChoice && levelUpChoice === "feat" && !selectedFeat) return;
    const choiceRecords: AdvancementChoice[] = advancementPrompts.map((prompt) => ({
      id: crypto.randomUUID(),
      featureId: prompt.featureId,
      featureName: prompt.featureName,
      level: nextLevel,
      kind: prompt.kind,
      selections: levelUpSelections[prompt.id] ?? [],
    }));
    const chosenSkillProficiencies = choiceRecords.filter((choice) => choice.kind === "skill").flatMap((choice) => choice.selections);
    const chosenExpertise = choiceRecords.filter((choice) => choice.kind === "expertise").flatMap((choice) => choice.selections);
    const chosenMasteries = choiceRecords.filter((choice) => choice.kind === "weapon-mastery").flatMap((choice) => choice.selections);
    const chosenFeatIds = choiceRecords.filter((choice) => choice.kind === "fighting-style").flatMap((choice) => choice.selections);
    const chosenSpellIds = choiceRecords.filter((choice) => choice.kind === "spell").flatMap((choice) => choice.selections);
    const chosenFeats = feats.filter((feat) => chosenFeatIds.includes(feat.id) && !character.feats.some((known) => known.id === feat.id));
    const chosenSpells = spells.filter((spell) => chosenSpellIds.includes(spell.id) && !character.spells.some((known) => known.id === spell.id)).map((spell) => ({ ...spell, prepared: true }));
    const progressionSlots = syncMulticlassSpellSlots(character.spellSlots, classLevels);
    const hitDiceByClass = character.hitDiceByClass.some((pool) => pool.className === selectedLevelUpClass.name)
      ? character.hitDiceByClass.map((pool) => pool.className === selectedLevelUpClass.name ? { ...pool, die: selectedLevelUpClass.hitDie, total: pool.total + 1 } : pool)
      : [...character.hitDiceByClass, { className: selectedLevelUpClass.name, die: selectedLevelUpClass.hitDie, total: 1, used: 0 }];
    const summaryParts = [`+${levelUpHpGain} HP`];
    if (hasAdvancementChoice && levelUpChoice === "abilities") summaryParts.push(`Ability increase: ${levelUpAbilities.map((ability) => ABILITY_LABELS[ability]).join(" / ")}`);
    if (selectedFeat) summaryParts.push(`Feat: ${selectedFeat.name}`);
    if (choiceRecords.length) summaryParts.push(`${choiceRecords.length} feature choice${choiceRecords.length === 1 ? "" : "s"}`);
    patchCharacter({
      level: nextLevel,
      classLevels,
      ...(selectedLevelUpClass.name === character.className ? { subclassName: selectedLevelUpSubclass?.name ?? character.subclassName } : {}),
      experience: 0,
      maxHp: character.maxHp + levelUpHpGain,
      currentHp: character.currentHp + levelUpHpGain,
      proficiencyBonus: proficiencyForLevel(nextLevel),
      hitDiceTotal: character.hitDiceTotal + 1,
      hitDiceByClass,
      abilities,
      skillProficiencies: [...new Set([...character.skillProficiencies, ...chosenSkillProficiencies])],
      skillExpertise: [...new Set([...character.skillExpertise, ...chosenExpertise])],
      weaponMasteries: [...new Set([...character.weaponMasteries, ...chosenMasteries])],
      advancementChoices: [...character.advancementChoices.filter((choice) => !(choice.level === nextLevel && choiceRecords.some((record) => record.featureId === choice.featureId && record.kind === choice.kind))), ...choiceRecords],
      resources: syncMulticlassResources(character.resources, classLevels, abilities),
      ...(progressionSlots ? { spellSlots: progressionSlots } : {}),
      feats: uniqueById([...character.feats, ...(selectedFeat && !character.feats.some((feat) => feat.id === selectedFeat.id) ? [selectedFeat] : []), ...chosenFeats]),
      spells: uniqueById([...character.spells, ...chosenSpells]),
      features: [...character.features, ...[...newFeatures, ...newSubclassFeatures].filter((feature) => !character.features.some((existing) => existing.name === feature.name))],
      advancementHistory: [...character.advancementHistory, {
        id: crypto.randomUUID(), createdAt: new Date().toISOString(), totalLevel: nextLevel,
        className: selectedLevelUpClass.name, classLevel: plannedClassLevel, hpGain: levelUpHpGain,
        summary: summaryParts.join(" · "), before: advancementSnapshot(character),
      }],
    });
    setShowLevelUp(false);
  }

  function rollbackLatestAdvancement() {
    const latest = character.advancementHistory.at(-1);
    if (!latest) return;
    if (!window.confirm(`Undo ${latest.className} level ${latest.classLevel}? Advancement statistics, features, feats, and spell choices will return to their previous state.`)) return;
    patchCharacter({ ...structuredClone(latest.before), advancementHistory: character.advancementHistory.slice(0, -1) });
  }

  async function importPack(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const pack: unknown = JSON.parse(await file.text());
      assertContentPack(pack);
      if (pack.pack.id === bundledPackId) {
        setStatus("The Warcraft campaign pack is included with the app and updates automatically");
        return;
      }
      await saveContentPack(pack);
      setStatus(`${pack.pack.name} imported and enabled`);
      setShowLibrary(true);
    } catch {
      setStatus("That file is not a valid Warcraft 5E content pack");
    }
  }

  async function saveContentPack(pack: ContentPack) {
    assertContentPack(pack);
    if (pack.pack.id === bundledPackId) throw new Error("The included campaign pack is read-only.");
    if (window.azerothDesktop) {
      await window.azerothDesktop.savePack(pack);
      await window.azerothDesktop.setPackEnabled(pack.pack.id, true);
    } else {
      const store = readBrowserStore();
      store.packs = [pack, ...store.packs.filter((item) => item.pack.id !== pack.pack.id)];
      store.disabledPackIds = store.disabledPackIds.filter((id) => id !== pack.pack.id);
      writeBrowserStore(store);
    }
    setCustomPacks((current) => [pack, ...current.filter((item) => item.pack.id !== pack.pack.id)]);
    setDisabledPackIds((current) => current.filter((id) => id !== pack.pack.id));
    setStatus(`${pack.pack.name} saved`);
  }

  async function toggleContentPack(id: string, enabled: boolean) {
    if (id === bundledPackId) return;
    if (window.azerothDesktop) await window.azerothDesktop.setPackEnabled(id, enabled);
    else {
      const store = readBrowserStore();
      store.disabledPackIds = enabled ? store.disabledPackIds.filter((item) => item !== id) : [...new Set([...store.disabledPackIds, id])];
      writeBrowserStore(store);
    }
    setDisabledPackIds((current) => enabled ? current.filter((item) => item !== id) : [...new Set([...current, id])]);
    setStatus(`Content pack ${enabled ? "enabled" : "disabled"}`);
  }

  async function exportContentPack(pack: ContentPack) {
    const contents = JSON.stringify(pack, null, 2);
    const filename = `${pack.pack.id}-${pack.pack.version}.w5e`;
    if (window.azerothDesktop) {
      const destination = await window.azerothDesktop.saveContentPack(filename, contents);
      setStatus(destination ? "Content pack exported" : "Content export canceled");
    } else {
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      setStatus("Content pack downloaded");
    }
  }

  async function removePack(id: string) {
    if (id === bundledPackId) {
      setStatus("The Warcraft campaign pack is included with the app and updates automatically");
      return;
    }
    if (window.azerothDesktop) {
      await window.azerothDesktop.deletePack(id);
    } else {
      const store = readBrowserStore();
      store.packs = store.packs.filter((item) => item.pack.id !== id);
      writeBrowserStore(store);
    }
    setCustomPacks((current) => current.filter((item) => item.pack.id !== id));
    setDisabledPackIds((current) => current.filter((item) => item !== id));
    setStatus("Content pack removed");
  }

  async function exportLegacyPdf() {
    setStatus("Building character sheet…");
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const classSummary = character.classLevels.map((entry) => `${entry.className} ${entry.level}${entry.subclassName ? ` (${entry.subclassName})` : ""}`).join(" / ") || character.className;
    const ink: [number, number, number] = [31, 37, 34];
    const green: [number, number, number] = [45, 99, 78];
    const gold: [number, number, number] = [192, 137, 55];
    doc.setFillColor(...green); doc.rect(0, 0, 612, 96, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.text(character.name || "Unnamed Hero", 42, 45);
    doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text(`${character.ancestry}  •  Level ${character.level}: ${classSummary}  •  ${character.background}`, 42, 68);
    doc.setTextColor(...ink); doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.text("WARCRAFT 5E CHARACTER RECORD", 570, 43, { align: "right" });
    doc.setFont("helvetica", "normal"); doc.setTextColor(225, 238, 231); doc.text(`Player: ${character.playerName || "—"}`, 570, 67, { align: "right" });

    const statY = 126;
    [["ARMOR", effectiveArmor.value], ["HIT POINTS", `${character.currentHp} / ${character.maxHp}${character.temporaryHp ? ` +${character.temporaryHp}` : ""}`], ["SPEED", `${effectiveSpeed.value} ft`], ["PROFICIENCY", `+${character.proficiencyBonus}`]].forEach(([label, value], index) => {
      const x = 42 + index * 132;
      doc.setDrawColor(219, 216, 205); doc.roundedRect(x, statY, 114, 54, 6, 6, "S");
      doc.setFontSize(8); doc.setTextColor(112, 112, 103); doc.text(String(label), x + 12, statY + 17);
      doc.setFontSize(17); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(String(value), x + 12, statY + 40);
    });

    doc.setFontSize(11); doc.setTextColor(...green); doc.text("ABILITIES", 42, 216);
    abilityKeys.forEach((key, index) => {
      const x = 42 + index * 88;
      doc.setDrawColor(...gold); doc.roundedRect(x, 230, 74, 70, 4, 4, "S");
      doc.setFontSize(7); doc.setTextColor(112, 112, 103); doc.text(ABILITY_LABELS[key].toUpperCase(), x + 37, 245, { align: "center" });
      doc.setFontSize(19); doc.setFont("helvetica", "bold"); doc.setTextColor(...ink); doc.text(String(character.abilities[key]), x + 37, 269, { align: "center" });
      doc.setFontSize(10); doc.setTextColor(...green); doc.text(modifierLabel(character.abilities[key]), x + 37, 288, { align: "center" });
    });

    doc.setFontSize(11); doc.setTextColor(...green); doc.text("FEATURES & TRAITS", 42, 338);
    let y = 358;
    resolvedFeatures.slice(0, 8).forEach((feature) => {
      const origin = featureOrigin(feature);
      doc.setFont("helvetica", "bold"); doc.setFontSize(10); doc.setTextColor(...ink); doc.text(origin ? `${feature.name} — ${origin}` : feature.name, 42, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(80, 83, 78);
      const lines = doc.splitTextToSize(feature.description, 500) as string[];
      doc.text(lines, 42, y + 13); y += 24 + lines.length * 9;
    });

    if (character.notes) {
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...green); doc.text("NOTES", 42, Math.min(y + 12, 690));
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(80, 83, 78);
      doc.text(doc.splitTextToSize(character.notes, 500), 42, Math.min(y + 30, 708));
    }
    doc.setFontSize(7); doc.setTextColor(140, 140, 132); doc.text("Generated with Azeroth Archives", 42, 758);

    doc.addPage();
    doc.setFillColor(...green); doc.rect(0, 0, 612, 68, "F");
    doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(18); doc.text(`${character.name || "Hero"} · Living Sheet`, 42, 41);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(`Hit Dice ${character.hitDiceTotal - character.hitDiceUsed}/${character.hitDiceTotal}  ·  Inspiration ${character.inspiration ? "Yes" : "No"}  ·  GP ${character.currency.gold}  SP ${character.currency.silver}  CP ${character.currency.copper}`, 570, 41, { align: "right" });
    let livingY = 96;
    const ensureLivingSpace = (height: number) => {
      if (livingY + height < 742) return;
      doc.setFontSize(7); doc.setTextColor(140, 140, 132); doc.text("Generated with Azeroth Archives", 42, 758);
      doc.addPage(); livingY = 54;
    };
    const addLivingSection = (title: string, rows: Array<{ name: string; detail: string }>) => {
      ensureLivingSpace(42);
      doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.setTextColor(...green); doc.text(title, 42, livingY); livingY += 17;
      if (!rows.length) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.setTextColor(120, 122, 116); doc.text("None recorded", 42, livingY); livingY += 20; return;
      }
      rows.forEach((row) => {
        const detailLines = doc.splitTextToSize(row.detail.slice(0, 500), 480) as string[];
        const height = 22 + Math.min(detailLines.length, 5) * 8;
        ensureLivingSpace(height);
        doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(...ink); doc.text(row.name, 42, livingY);
        doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); doc.setTextColor(80, 83, 78); doc.text(detailLines.slice(0, 5), 42, livingY + 11);
        livingY += height;
      });
      livingY += 6;
    };
    addLivingSection("SAVING THROWS", abilityKeys.map((ability) => {
      const proficient = character.savingThrowProficiencies.includes(ability);
      const modifier = abilityModifier(character.abilities[ability]) + (proficient ? character.proficiencyBonus : 0) + (character.savingThrowBonuses[ability] ?? 0);
      return { name: `${proficient ? "Proficient · " : ""}${ABILITY_LABELS[ability]}`, detail: `${modifier >= 0 ? "+" : ""}${modifier}` };
    }));
    addLivingSection("SKILLS", SKILLS.map((skill) => {
      const expertise = character.skillExpertise.includes(skill.name);
      const proficient = character.skillProficiencies.includes(skill.name);
      const modifier = abilityModifier(character.abilities[skill.ability]) + character.proficiencyBonus * (expertise ? 2 : proficient ? 1 : 0);
      return { name: `${expertise ? "Expertise · " : proficient ? "Proficient · " : ""}${skill.name}`, detail: `${ABILITY_LABELS[skill.ability]} ${modifier >= 0 ? "+" : ""}${modifier}` };
    }));
    addLivingSection("ATTACKS", character.attacks.map((attack) => {
      const modifier = abilityModifier(character.abilities[attack.ability]) + (attack.proficient ? character.proficiencyBonus : 0) + attack.bonus;
      const damageModifier = abilityModifier(character.abilities[attack.ability]) + attack.damageBonus;
      return { name: attack.name, detail: `Attack ${modifier >= 0 ? "+" : ""}${modifier} · ${attack.damage || "—"}${damageModifier ? ` ${damageModifier >= 0 ? "+" : ""}${damageModifier}` : ""} ${attack.damageType}${attack.notes ? ` · ${attack.notes}` : ""}` };
    }));
    addLivingSection("FEATS", character.feats.map((feat) => ({ name: feat.name, detail: `${feat.category}${feat.prerequisite ? ` · ${feat.prerequisite}` : ""}\n${feat.description}` })));
    addLivingSection("SPELLBOOK", character.spells.map((spell) => ({ name: `${spell.prepared ? "Prepared · " : ""}${spell.name}`, detail: `${spell.level ? `Level ${spell.level}` : "Cantrip"} ${spell.school} · ${spell.castingTime} · ${spell.range} · ${spell.duration}` })));
    addLivingSection("EQUIPMENT", character.inventory.map((item) => ({ name: `${item.equipped ? "Equipped · " : ""}${item.quantity}× ${item.name}`, detail: [item.category, item.equipmentSlot && item.equipmentSlot !== "none" ? item.equipmentSlot.replace("-", " ") : "", item.weight, item.cost, item.attuned ? "Attuned" : "", item.ammunition !== undefined ? `${item.ammunition} ammunition` : "", item.maximumCharges !== undefined ? `${item.charges ?? 0}/${item.maximumCharges} charges` : "", item.container ? `In ${item.container}` : "", item.notes].filter(Boolean).join(" · ") })));
    addLivingSection("TRAINING & CHOICES", [
      { name: "Armor", detail: character.armorProficiencies.join(", ") || "None" },
      { name: "Weapons", detail: character.weaponProficiencies.join(", ") || "None" },
      { name: "Weapon masteries", detail: character.weaponMasteries.join(", ") || "None" },
      { name: "Languages", detail: character.languages.join(", ") || "None" },
      { name: "Tools", detail: character.toolProficiencies.join(", ") || "None" },
      ...character.advancementChoices.map((choice) => ({ name: `${choice.featureName} · Level ${choice.level}`, detail: choice.selections.join(", ") })),
    ]);
    addLivingSection("CLASS RESOURCES", character.resources.map((resource) => ({ name: resource.name, detail: `${resource.current}/${resource.maximum} · ${resource.recovery === "short" ? "Short or Long Rest" : resource.recovery === "short-one" ? "One use on Short Rest; all on Long Rest" : resource.recovery === "long" ? "Long Rest" : "Manual recovery"}` })));
    addLivingSection("DEFENSES", [
      { name: "Resistances", detail: character.damageResistances.join(", ") || "None" },
      { name: "Vulnerabilities", detail: character.damageVulnerabilities.join(", ") || "None" },
      { name: "Damage immunities", detail: character.damageImmunities.join(", ") || "None" },
      { name: "Condition immunities", detail: character.conditionImmunities.join(", ") || "None" },
    ]);
    addLivingSection("ENCUMBRANCE", [{ name: `${encumbrance.totalWeight}/${encumbrance.carryingCapacity} lb. · ${encumbrance.label}`, detail: encumbrance.penalty }]);
    addLivingSection("ACTIVE EFFECTS", character.activeEffects.map((effect) => ({ name: `${effect.concentration ? "Concentration · " : ""}${effect.name}`, detail: `${effect.source} · ${effect.duration === "rounds" ? `${effect.remaining} rounds` : effect.duration === "minutes" ? `${effect.remaining} minutes` : effect.duration === "until-rest" ? "Until rest" : "Manual"}${effect.condition ? ` · ${effect.condition}` : ""}` })));
    if (spellcastingAbility) {
      const spellcastingModifier = abilityModifier(character.abilities[spellcastingAbility]);
      const spellAttack = spellcastingModifier + character.proficiencyBonus;
      const concentratingSpell = character.spells.find((spell) => spell.id === character.concentratingSpellId);
      addLivingSection("SPELLCASTING", [{ name: ABILITY_LABELS[spellcastingAbility], detail: `Spell save DC ${8 + spellAttack} · Spell attack ${spellAttack >= 0 ? "+" : ""}${spellAttack}${concentratingSpell ? ` · Concentrating: ${concentratingSpell.name}` : ""}` }]);
    }
    if (character.conditions.length) addLivingSection("ACTIVE CONDITIONS", character.conditions.map((condition) => ({ name: condition === "Exhaustion" ? `Exhaustion ${character.exhaustionLevel}` : condition, detail: conditionEffectText(condition, character.exhaustionLevel) })));
    addLivingSection("COMPANIONS & SUMMONS", character.companions.map((companion) => ({ name: `${companion.active ? "Active · " : ""}${companion.name}`, detail: `${companion.kind} · HP ${companion.currentHp}/${companion.maxHp} · AC ${companion.armorClass} · ${companion.speed}${companion.notes ? ` · ${companion.notes}` : ""}` })));
    addLivingSection("JOURNAL", character.journal.filter((entry) => entry.status !== "archived").map((entry) => ({ name: `${entry.pinned ? "Pinned · " : ""}${entry.title}`, detail: `${entry.type} · ${entry.status}${entry.details ? ` · ${entry.details}` : ""}` })));
    doc.setFontSize(7); doc.setTextColor(140, 140, 132); doc.text("Generated with Azeroth Archives", 42, 758);
    const filename = `${character.name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "character"}.pdf`;
    if (window.azerothDesktop) {
      const bytes = Array.from(new Uint8Array(doc.output("arraybuffer")));
      const destination = await window.azerothDesktop.savePdf(filename, bytes);
      setStatus(destination ? "Character sheet saved" : "PDF export canceled");
    } else {
      doc.save(filename);
      setStatus("Character sheet downloaded");
    }
  }

  async function exportPdf() {
    setStatus("Building character sheet...");
    const classSummary = character.classLevels
      .map((entry) => `${entry.className} ${entry.level}${entry.subclassName ? ` (${entry.subclassName})` : ""}`)
      .join(" / ") || character.className || "Class not recorded";
    const savingThrowRows = abilityKeys.map((ability) => {
      const proficient = character.savingThrowProficiencies.includes(ability);
      const modifier = abilityModifier(character.abilities[ability]) + (proficient ? character.proficiencyBonus : 0) + (character.savingThrowBonuses[ability] ?? 0);
      return { name: `${proficient ? "Proficient - " : ""}${ABILITY_LABELS[ability]}`, detail: `${modifier >= 0 ? "+" : ""}${modifier}` };
    });
    const skillRows = SKILLS.map((skill) => {
      const expertise = character.skillExpertise.includes(skill.name);
      const proficient = character.skillProficiencies.includes(skill.name);
      const modifier = abilityModifier(character.abilities[skill.ability]) + character.proficiencyBonus * (expertise ? 2 : proficient ? 1 : 0);
      return {
        name: `${expertise ? "Expertise - " : proficient ? "Proficient - " : ""}${skill.name}`,
        detail: `${ABILITY_LABELS[skill.ability]} ${modifier >= 0 ? "+" : ""}${modifier}`,
        priority: expertise ? 2 : proficient ? 1 : 0,
      };
    }).sort((left, right) => right.priority - left.priority || left.name.localeCompare(right.name));
    const attackRows = character.attacks.map((attack) => {
      const modifier = abilityModifier(character.abilities[attack.ability]) + (attack.proficient ? character.proficiencyBonus : 0) + attack.bonus;
      const damageModifier = abilityModifier(character.abilities[attack.ability]) + attack.damageBonus;
      return {
        name: attack.name,
        detail: `Attack ${modifier >= 0 ? "+" : ""}${modifier} - ${attack.damage || "No damage die"}${damageModifier ? ` ${damageModifier >= 0 ? "+" : ""}${damageModifier}` : ""} ${attack.damageType}${attack.notes ? ` - ${attack.notes}` : ""}`,
      };
    });
    const featRows = character.feats.map((feat) => ({
      name: feat.name,
      detail: `${feat.category}${feat.prerequisite ? ` - ${feat.prerequisite}` : ""}\n${feat.description}`,
    }));
    const spellRows = [...character.spells]
      .sort((left, right) => Number(right.prepared) - Number(left.prepared) || left.level - right.level || left.name.localeCompare(right.name))
      .map((spell) => ({
        name: `${spell.prepared ? "Prepared - " : ""}${spell.name}`,
        detail: `${spell.level ? `Level ${spell.level}` : "Cantrip"} ${spell.school} - ${spell.castingTime} - ${spell.range} - ${spell.duration}`,
      }));
    const equipmentRows = character.inventory.map((item) => ({
      name: `${item.equipped ? "Equipped - " : ""}${item.quantity}x ${item.name}`,
      detail: [
        item.category,
        item.equipmentSlot && item.equipmentSlot !== "none" ? item.equipmentSlot.replace("-", " ") : "",
        item.weight,
        item.cost,
        item.attuned ? "Attuned" : "",
        item.ammunition !== undefined ? `${item.ammunition} ammunition` : "",
        item.maximumCharges !== undefined ? `${item.charges ?? 0}/${item.maximumCharges} charges` : "",
        item.container ? `In ${item.container}` : "",
        item.notes,
      ].filter(Boolean).join(" - "),
    }));
    const featureRows = resolvedFeatures.map((feature) => {
      const origin = featureOrigin(feature);
      return { name: origin ? `${feature.name} - ${origin}` : feature.name, detail: feature.description };
    });
    const noteRows = character.notes ? [{ name: "Campaign notes", detail: character.notes }] : [];
    const overviewSections: CharacterPdfSection[] = [
      { title: "SAVING THROWS", icon: "shield", rows: savingThrowRows },
      { title: "SKILLS", icon: "book", rows: skillRows },
      { title: "ATTACKS", icon: "blades", rows: attackRows },
      { title: "FEATURES", icon: "scroll", rows: featureRows },
      { title: "SPELLS", icon: "spark", rows: spellRows },
      { title: "EQUIPMENT", icon: "satchel", rows: equipmentRows },
      { title: "NOTES", icon: "quill", rows: noteRows },
    ];
    const detailSections: CharacterPdfSection[] = [
      { title: "SAVING THROWS", icon: "shield", rows: savingThrowRows },
      { title: "SKILLS", icon: "book", rows: skillRows },
      { title: "ATTACKS", icon: "blades", rows: attackRows },
      { title: "FEATURES AND TRAITS", icon: "scroll", rows: featureRows },
      { title: "FEATS", icon: "scroll", rows: featRows },
      { title: "SPELLBOOK", icon: "spark", rows: spellRows },
      { title: "EQUIPMENT", icon: "satchel", rows: equipmentRows },
      {
        title: "TRAINING AND CHOICES",
        icon: "book",
        rows: [
          { name: "Armor", detail: character.armorProficiencies.join(", ") || "None" },
          { name: "Weapons", detail: character.weaponProficiencies.join(", ") || "None" },
          { name: "Weapon masteries", detail: character.weaponMasteries.join(", ") || "None" },
          { name: "Languages", detail: character.languages.join(", ") || "None" },
          { name: "Tools", detail: character.toolProficiencies.join(", ") || "None" },
          ...character.advancementChoices.map((choice) => ({ name: `${choice.featureName} - Level ${choice.level}`, detail: choice.selections.join(", ") })),
        ],
      },
      {
        title: "CLASS RESOURCES",
        icon: "spark",
        rows: character.resources.map((resource) => ({
          name: resource.name,
          detail: `${resource.current}/${resource.maximum} - ${resource.recovery === "short" ? "Short or Long Rest" : resource.recovery === "short-one" ? "One use on Short Rest; all on Long Rest" : resource.recovery === "long" ? "Long Rest" : "Manual recovery"}`,
        })),
      },
      {
        title: "DEFENSES",
        icon: "shield",
        rows: [
          { name: "Resistances", detail: character.damageResistances.join(", ") || "None" },
          { name: "Vulnerabilities", detail: character.damageVulnerabilities.join(", ") || "None" },
          { name: "Damage immunities", detail: character.damageImmunities.join(", ") || "None" },
          { name: "Condition immunities", detail: character.conditionImmunities.join(", ") || "None" },
        ],
      },
      { title: "ENCUMBRANCE", icon: "satchel", rows: [{ name: `${encumbrance.totalWeight}/${encumbrance.carryingCapacity} lb. - ${encumbrance.label}`, detail: encumbrance.penalty }] },
      {
        title: "ACTIVE EFFECTS",
        icon: "spark",
        rows: character.activeEffects.map((effect) => ({
          name: `${effect.concentration ? "Concentration - " : ""}${effect.name}`,
          detail: `${effect.source} - ${effect.duration === "rounds" ? `${effect.remaining} rounds` : effect.duration === "minutes" ? `${effect.remaining} minutes` : effect.duration === "until-rest" ? "Until rest" : "Manual"}${effect.condition ? ` - ${effect.condition}` : ""}`,
        })),
      },
      ...(spellcastingAbility ? [{
        title: "SPELLCASTING",
        icon: "spark" as const,
        rows: (() => {
          const modifier = abilityModifier(character.abilities[spellcastingAbility]);
          const attack = modifier + character.proficiencyBonus;
          const concentratingSpell = character.spells.find((spell) => spell.id === character.concentratingSpellId);
          return [{ name: ABILITY_LABELS[spellcastingAbility], detail: `Spell save DC ${8 + attack} - Spell attack ${attack >= 0 ? "+" : ""}${attack}${concentratingSpell ? ` - Concentrating: ${concentratingSpell.name}` : ""}` }];
        })(),
      }] : []),
      ...(character.conditions.length ? [{
        title: "ACTIVE CONDITIONS",
        icon: "heart" as const,
        rows: character.conditions.map((condition) => ({ name: condition === "Exhaustion" ? `Exhaustion ${character.exhaustionLevel}` : condition, detail: conditionEffectText(condition, character.exhaustionLevel) })),
      }] : []),
      {
        title: "COMPANIONS AND SUMMONS",
        icon: "star",
        rows: character.companions.map((companion) => ({
          name: `${companion.active ? "Active - " : ""}${companion.name}`,
          detail: `${companion.kind} - HP ${companion.currentHp}/${companion.maxHp} - AC ${companion.armorClass} - ${companion.speed}${companion.notes ? ` - ${companion.notes}` : ""}`,
        })),
      },
      {
        title: "JOURNAL",
        icon: "quill",
        rows: character.journal.filter((entry) => entry.status !== "archived").map((entry) => ({
          name: `${entry.pinned ? "Pinned - " : ""}${entry.title}`,
          detail: `${entry.type} - ${entry.status}${entry.details ? ` - ${entry.details}` : ""}`,
        })),
      },
      { title: "NOTES", icon: "quill", rows: noteRows },
    ];
    const bytes = await buildCharacterPdf({
      name: character.name || "Unnamed Hero",
      playerName: character.playerName,
      identityLine: `${character.ancestry || "Ancestry not recorded"} - Level ${character.level}: ${classSummary} - ${character.background || "Background not recorded"}`,
      portraitDataUrl: character.portraitDataUrl,
      stats: [
        { label: "ARMOR", value: String(effectiveArmor.value), icon: "shield" },
        { label: "HIT POINTS", value: `${character.currentHp} / ${character.maxHp}${character.temporaryHp ? ` +${character.temporaryHp}` : ""}`, icon: "heart" },
        { label: "SPEED", value: `${effectiveSpeed.value} FT`, icon: "boot" },
        { label: "PROFICIENCY", value: `+${character.proficiencyBonus}`, icon: "star" },
      ],
      abilities: abilityKeys.map((ability) => ({ label: ABILITY_LABELS[ability], score: character.abilities[ability], modifier: modifierLabel(character.abilities[ability]) })),
      overviewSections,
      detailMeta: `Hit Dice ${character.hitDiceTotal - character.hitDiceUsed}/${character.hitDiceTotal} - Inspiration ${character.inspiration ? "Yes" : "No"} - GP ${character.currency.gold} SP ${character.currency.silver} CP ${character.currency.copper}`,
      detailSections,
    });
    const filename = `${character.name.trim().replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "character"}.pdf`;
    if (window.azerothDesktop) {
      const destination = await window.azerothDesktop.savePdf(filename, Array.from(bytes));
      setStatus(destination ? "Character sheet saved" : "PDF export canceled");
    } else {
      const anchor = document.createElement("a");
      anchor.href = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(anchor.href);
      setStatus("Character sheet downloaded");
    }
  }

  return (
    <main className="app-shell">
      <input ref={fileInput} className="sr-only" type="file" accept=".json,.w5e,application/json" onChange={importPack} />
      <input ref={characterFileInput} className="sr-only" type="file" accept=".json,application/json" onChange={importCharacter} />
      <input ref={fullBackupFileInput} className="sr-only" type="file" accept=".json,application/json" onChange={importFullBackup} />
      <input ref={portraitFileInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={choosePortrait} />
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="Open roster" onClick={() => setShowRoster(true)}><Menu size={20} /></button>
        <div className="brand-mark" aria-hidden="true">A</div>
        <div className="brand-copy">
          <div className="brand-title-row"><strong>Azeroth Archives</strong><small className="app-version">v{packageMetadata.version}</small></div>
          <span>Offline Warcraft 5E character manager</span>
        </div>
        <div className="topbar-actions">
          <button className="button button-quiet" onClick={() => setShowLibrary(true)}><LibraryBig size={16} /><span>Content library</span><b>{content.length}</b></button>
          <button className="button button-outline" onClick={exportPdf}><Download size={16} /><span>Export PDF</span></button>
          <button className="button button-primary" onClick={saveCharacter} disabled={saving}><Save size={16} />{saving ? "Saving" : "Save character"}</button>
          <button className="avatar-button" title="Settings, updates, and local data" aria-label="Open settings" onClick={() => setShowSettings(true)}><HardDrive size={19} /></button>
        </div>
      </header>

      <aside className={`roster-panel ${showRoster ? "is-open" : ""}`}>
        <div className="roster-heading"><div><span className="eyebrow">Your party</span><h2>Characters</h2></div><button className="icon-button mobile-only" onClick={() => setShowRoster(false)} aria-label="Close roster"><X size={18} /></button></div>
        <button className="button button-create" onClick={() => { setCharacter(newCharacter()); setShowRoster(false); setStatus("New character draft"); }}><Plus size={17} />Create character</button>
        <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a character" /></label>
        <div className="character-list">
          {visibleCharacters.map((item, index) => (
            <div key={item.id} className={`character-row ${item.id === character.id ? "active" : ""}`}>
              <button className="character-row-select" onClick={() => { setCharacter(item); setMenuCharacterId(null); setShowRoster(false); }}>
                <span className={`mini-portrait tone-${index % 4}`}>{item.portraitDataUrl ? <img src={item.portraitDataUrl} alt="" /> : initials(item.name)}</span>
                <span><strong>{item.name}</strong><small>Level {item.level} {item.className}</small></span>
              </button>
              <button className="character-row-more" aria-label={`Actions for ${item.name}`} aria-expanded={menuCharacterId === item.id} onClick={() => setMenuCharacterId((current) => current === item.id ? null : item.id)}><MoreHorizontal size={16} /></button>
              {menuCharacterId === item.id && <div className="character-actions" role="menu">
                <button onClick={() => duplicateCharacter(item)}><Copy size={13} />Duplicate</button>
                <button onClick={() => exportCharacter(item)}><FileDown size={13} />Export backup</button>
                <button className="danger" onClick={() => deleteCharacter(item)}><Trash2 size={13} />Delete</button>
              </div>}
            </div>
          ))}
          {!visibleCharacters.length && <div className="empty-roster"><Swords size={24} /><p>No saved heroes yet.</p><span>Your first character will appear here after saving.</span></div>}
        </div>
        <div className="roster-imports">
          <button className="import-card" onClick={exportFullBackup}>
            <span className="import-icon"><HardDrive size={20} /></span>
            <span><strong>Back up everything</strong><small>Characters and imported content</small></span>
            <Download size={16} />
          </button>
          <button className="import-card" onClick={() => fullBackupFileInput.current?.click()}>
            <span className="import-icon"><Upload size={20} /></span>
            <span><strong>Restore full backup</strong><small>Replace this device's local library</small></span>
            <FileDown size={16} />
          </button>
          <button className="import-card" onClick={() => characterFileInput.current?.click()}>
            <span className="import-icon"><FileDown size={20} /></span>
            <span><strong>Import character</strong><small>Restore a character backup</small></span>
            <Upload size={16} />
          </button>
          <button className="import-card" onClick={() => fileInput.current?.click()}>
            <span className="import-icon"><FileJson size={20} /></span>
            <span><strong>Import custom content</strong><small>Add local .json or .w5e files</small></span>
            <Upload size={16} />
          </button>
        </div>
        <div className="sync-status"><span className={status.includes("not") || status.includes("Could") ? "status-dot warning" : "status-dot"} />{status}</div>
      </aside>

      <section className="workspace">
        <div className="character-hero">
          <div className={`portrait-large ${character.portraitDataUrl ? "has-image" : ""}`}>
            {character.portraitDataUrl ? <img src={character.portraitDataUrl} alt={`${character.name || "Character"} portrait`} /> : <span>{initials(character.name)}</span>}
            <button aria-label={character.portraitDataUrl ? "Change portrait" : "Add portrait"} title={character.portraitDataUrl ? "Change portrait" : "Add portrait"} onClick={() => portraitFileInput.current?.click()}><Plus size={14} /></button>
          </div>
          <div className="hero-identity">
            <label className="eyebrow" htmlFor="character-name">Character name</label>
            <input id="character-name" className="name-input" value={character.name} onChange={(event) => patchCharacter({ name: event.target.value })} />
            <div className="identity-selects">
              <DescriptionPicker className="identity-picker" ariaLabel="Ancestry" value={character.ancestry} placeholder="Choose ancestry" onChange={applyAncestry} options={ancestries.map((item) => ({ value: item.name, label: item.name, meta: `${item.speed} ft. speed · ${item.traits.length} traits`, description: ancestryDescription(item) }))} />
              <i />
              <DescriptionPicker className="identity-picker" ariaLabel="Class" value={character.className} placeholder="Choose class" onChange={applyClass} options={classes.map((item) => ({ value: item.name, label: item.name, meta: `d${item.hitDie} Hit Die · ${ABILITY_LABELS[item.primaryAbility]}`, description: classDescription(item) }))} />
              <i />
              {!!subclasses.length && <><DescriptionPicker className="identity-picker" ariaLabel="Subclass" value={character.subclassName ?? ""} placeholder="Choose subclass" onChange={applySubclass} options={subclasses.map((item) => ({ value: item.name, label: item.name, meta: `${selectedClass?.name ?? "Class"} specialization`, description: item.description || Object.values(item.levelFeatures).flat().map((feature) => `${feature.name}: ${feature.description}`).join("\n\n") }))} /><i /></>}
              <DescriptionPicker className="identity-picker" ariaLabel="Background" value={character.background} placeholder="Choose background" onChange={applyBackground} options={backgrounds.map((item) => ({ value: item.name, label: item.name, meta: [item.skills.join(", "), item.featId?.replaceAll("-", " ")].filter(Boolean).join(" · "), description: backgroundDescription(item) }))} />
            </div>
          </div>
          <div className="level-card">
            <div><span>Level</span><strong>{character.level}</strong></div>
            <button className="button level-button" onClick={levelUp} disabled={character.level >= 20}><Sparkles size={15} />Level up</button>
            <div className="xp-row"><span>{character.experience.toLocaleString()} XP</span><span>{nextLevelXp.toLocaleString()} XP</span></div>
            <div className="progress-track"><span style={{ width: `${xpProgress}%` }} /></div>
          </div>
        </div>

        <nav className="tabs" aria-label="Character sections">
          {(["overview", "features", "actions", "combat", "spells", "equipment", "companions", "notes"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}{item === "combat" && character.attacks.length ? ` ${character.attacks.length}` : ""}{item === "spells" && character.spells.length ? ` ${character.spells.length}` : ""}{item === "equipment" && character.inventory.length ? ` ${character.inventory.length}` : ""}{item === "companions" && character.companions.length ? ` ${character.companions.length}` : ""}</button>)}
        </nav>

        {tab === "overview" && (
          <div className="overview-grid">
            <section className="panel vitals-panel">
              <div className="section-heading"><div><span className="eyebrow">At a glance</span><h2>Combat & vitals</h2></div><Shield size={20} /></div>
              <div className="vital-grid">
                <label><span><Heart size={15} />Hit points</span><div className="paired-input"><input type="number" value={character.currentHp} onChange={(event) => patchCharacter({ currentHp: Number(event.target.value) })} /><b>/</b><input type="number" value={character.maxHp} onChange={(event) => patchCharacter({ maxHp: Number(event.target.value) })} /></div><small>Current / Maximum</small></label>
                <label><span><Shield size={15} />Armor class</span><input className="stat-input" type="number" value={effectiveArmor.value} readOnly={effectiveArmor.automatic} onChange={(event) => patchCharacter({ armorClass: Number(event.target.value) })} /><small>{effectiveArmor.source}</small></label>
                <label><span><Zap size={15} />Effective speed</span><div className="unit-input"><input type="number" value={effectiveSpeed.value} readOnly={effectiveSpeed.effects.length > 0} onChange={(event) => patchCharacter({ speed: Number(event.target.value) })} /><b>ft</b></div><small>{effectiveSpeed.effects.length ? `Base ${character.speed} · ${effectiveSpeed.effects.join(" · ")}` : "Walking"}</small></label>
                <label><span><Swords size={15} />Proficiency</span><div className="static-stat">+{character.proficiencyBonus}</div><small>Level based</small></label>
              </div>
            </section>

            <section className="panel abilities-panel">
              <div className="section-heading"><div><span className="eyebrow">Core scores</span><h2>Abilities</h2></div><span className="section-note">Modifier</span></div>
              <div className="ability-grid">
                {abilityKeys.map((key) => (
                  <label key={key} className="ability-card"><span>{ABILITY_LABELS[key]}</span><input type="number" value={character.abilities[key]} onChange={(event) => updateAbility(key, Number(event.target.value))} /><strong>{modifierLabel(character.abilities[key])}</strong></label>
                ))}
              </div>
            </section>

            <section className="panel details-panel">
              <div className="section-heading"><div><span className="eyebrow">Identity</span><h2>Character details</h2></div><BookOpen size={20} /></div>
              <div className="form-grid">
                <label><span>Player name</span><input value={character.playerName} onChange={(event) => patchCharacter({ playerName: event.target.value })} placeholder="Your name" /></label>
                <label><span>Experience points</span><input type="number" min="0" value={character.experience} onChange={(event) => patchCharacter({ experience: Math.max(0, Number(event.target.value)) })} /></label>
              </div>
              <div className="feature-preview">
                <div><span className="eyebrow">Recently gained</span><h3>{resolvedFeatures.at(-1)?.name ?? "Ready for adventure"}</h3>{resolvedFeatures.at(-1) && featureOrigin(resolvedFeatures.at(-1)!) && <small className="feature-origin">Granted by {featureOrigin(resolvedFeatures.at(-1)!)}</small>}<p>{resolvedFeatures.at(-1)?.description ?? "Add features through your ancestry, class, or an imported content pack."}</p></div>
                <button className="text-button" onClick={() => setTab("features")}>View all features <span>→</span></button>
              </div>
            </section>
            <CreationGuide character={character} patchCharacter={patchCharacter} background={selectedBackground} feats={feats} equipment={equipment} />
            <SessionTracker character={character} patchCharacter={patchCharacter} hitDicePools={hitDicePools} />
            <AdvancementPanel character={character} onRollback={rollbackLatestAdvancement} />
          </div>
        )}

        {tab === "features" && (
          <div className="stacked-tab-panels">
          <FeatManager catalog={feats} character={character} patchCharacter={patchCharacter} />
          <section className="panel wide-panel">
            <div className="section-heading"><div><span className="eyebrow">Rules reference</span><h2>Features & traits</h2></div><span className="count-chip">{character.features.length}</span></div>
            <div className="feature-list">
              {resolvedFeatures.map((feature, index) => <article key={`${feature.name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><div className="feature-title-row"><h3>{feature.name}</h3>{featureOrigin(feature) && <small className="feature-origin">{featureOrigin(feature)}</small>}</div><p>{feature.description}</p></div></article>)}
              {!character.features.length && <div className="empty-state">No features yet. Choose an ancestry and class or import a content pack.</div>}
            </div>
          </section>
          </div>
        )}

        {tab === "actions" && <ActionDashboard character={character} patchCharacter={patchCharacter} catalog={equipment} />}

        {tab === "combat" && <CombatManager catalog={equipment} character={character} patchCharacter={patchCharacter} />}

        {tab === "spells" && <SpellbookManager catalog={spells} equipmentCatalog={equipment} character={character} patchCharacter={patchCharacter} spellcastingAbility={spellcastingAbility} />}

        {tab === "equipment" && <InventoryManager catalog={equipment} character={character} patchCharacter={patchCharacter} />}

        {tab === "companions" && <CompanionManager catalog={creatures} character={character} patchCharacter={patchCharacter} />}

        {tab === "notes" && <JournalManager character={character} patchCharacter={patchCharacter} />}
      </section>

      {deleteTarget && <div className="modal-scrim" onMouseDown={() => setDeleteTarget(null)}>
        <section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-character-title" onMouseDown={(event) => event.stopPropagation()}>
          <span className="eyebrow">Remove character</span>
          <h2 id="delete-character-title">Delete {deleteTarget.name}?</h2>
          <p>This removes the character from this device. Export a backup first if you may need to restore it later.</p>
          <div className="level-up-actions">
            <button className="button button-outline" onClick={() => setDeleteTarget(null)}>Cancel</button>
            <button className="button button-danger" onClick={confirmDeleteCharacter}><Trash2 size={15} />Delete character</button>
          </div>
        </section>
      </div>}

      {showLevelUp && <div className="modal-scrim" onMouseDown={() => setShowLevelUp(false)}>
        <section className="level-up-dialog" role="dialog" aria-modal="true" aria-labelledby="level-up-title" onMouseDown={(event) => event.stopPropagation()}>
          <div className="drawer-heading">
            <div><span className="eyebrow">Character advancement</span><h2 id="level-up-title">Review level {plannedLevel}</h2></div>
            <button className="icon-button" onClick={() => setShowLevelUp(false)} aria-label="Cancel level up"><X size={18} /></button>
          </div>
          <div className="level-up-summary">
            <label><span>Advance class</span><select value={selectedLevelUpClass?.name ?? ""} onChange={(event) => changeLevelUpClass(event.target.value)}>{classes.map((definition) => <option key={definition.id} value={definition.name}>{definition.name}{character.classLevels.some((entry) => entry.className === definition.name) ? ` (level ${character.classLevels.find((entry) => entry.className === definition.name)?.level})` : " (new class)"}</option>)}</select></label>
            <div><span>Class level</span><strong>{plannedClassLevel}</strong></div>
            <div><span>Proficiency</span><strong>+{proficiencyForLevel(plannedLevel)}</strong></div>
            <label><span>Hit points gained</span><input type="number" min="1" max="99" value={levelUpHpGain} onChange={(event) => setLevelUpHpGain(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} /></label>
          </div>
          {!!selectedLevelUpClass?.subclasses?.length && <label className="level-up-subclass"><span>Specialization</span><select value={selectedLevelUpSubclass?.name ?? ""} onChange={(event) => { setLevelUpSubclassName(event.target.value); setLevelUpSelections({}); }}><option value="">Choose when granted</option>{selectedLevelUpClass.subclasses.map((subclass) => <option key={subclass.id} value={subclass.name}>{subclass.name}</option>)}</select><small>A specialization is required when this class level grants its first specialization feature.</small></label>}
          {hasAdvancementChoice && <div className="advancement-choice">
            <span className="eyebrow">Ability Score Improvement choice</span>
            <div className="advancement-choice-tabs"><button className={levelUpChoice === "abilities" ? "active" : ""} onClick={() => setLevelUpChoice("abilities")}>Increase abilities</button><button className={levelUpChoice === "feat" ? "active" : ""} onClick={() => setLevelUpChoice("feat")}>Choose a feat</button></div>
            {levelUpChoice === "abilities" ? <div className="advancement-abilities">
              <label>First +1<select value={levelUpAbilities[0]} onChange={(event) => setLevelUpAbilities([event.target.value as AbilityKey, levelUpAbilities[1]])}>{abilityKeys.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]} ({character.abilities[ability]})</option>)}</select></label>
              <label>Second +1<select value={levelUpAbilities[1]} onChange={(event) => setLevelUpAbilities([levelUpAbilities[0], event.target.value as AbilityKey])}>{abilityKeys.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]} ({character.abilities[ability]})</option>)}</select></label>
              <small>Select the same ability twice for +2. Ability Score Improvements cannot raise a score above 20.</small>
            </div> : <label className="advancement-feat">Feat<select value={levelUpFeatId} onChange={(event) => setLevelUpFeatId(event.target.value)}><option value="">Choose an eligible feat</option>{feats.filter((feat) => !character.feats.some((known) => known.id === feat.id)).map((feat) => <option key={feat.id} value={feat.id}>{feat.name}{feat.prerequisite ? ` — ${feat.prerequisite}` : ""}</option>)}</select><small>Prerequisites are shown for review; the app does not override the GM’s eligibility ruling.</small></label>}
          </div>}
          {advancementPrompts.length > 0 && <div className="advancement-prompts"><span className="eyebrow">Feature choices</span>{advancementPrompts.map((prompt) => {
            const options = advancementOptions(prompt);
            const selections = levelUpSelections[prompt.id] ?? Array.from({ length: prompt.count }, () => "");
            return <div className="advancement-prompt" key={prompt.id}><strong>{prompt.featureName}</strong><small>Choose {prompt.count} {prompt.label.toLowerCase()}{prompt.count === 1 ? "" : "s"}.</small><div>{Array.from({ length: prompt.count }, (_, index) => <label key={index}>{prompt.label} {index + 1}<select aria-label={`${prompt.featureName} ${prompt.label} ${index + 1}`} value={selections[index] ?? ""} onChange={(event) => setAdvancementSelection(prompt.id, index, event.target.value)}><option value="">Choose…</option>{options.map((option) => <option disabled={selections.some((selection, selectedIndex) => selectedIndex !== index && selection === option.value)} value={option.value} key={option.value}>{option.label}</option>)}</select></label>)}</div>{!options.length && <p>No eligible options are currently available. Review existing proficiencies or imported content.</p>}</div>;
          })}{!advancementChoicesComplete && <p className="level-up-warning">Complete each feature choice before advancing.</p>}</div>}
          {syncMulticlassSpellSlots(character.spellSlots, currentLevelUpEntry ? character.classLevels.map((entry) => entry.className === selectedLevelUpClass?.name ? { ...entry, level: plannedClassLevel, subclassName: selectedLevelUpSubclass?.name ?? entry.subclassName } : entry) : [...character.classLevels, { className: selectedLevelUpClass?.name ?? "", subclassName: selectedLevelUpSubclass?.name, level: 1 }]) && <p className="progression-note">Combined multiclass spell slots will update automatically. Spells known and prepared remain tracked by their individual class rules.</p>}
          <div className="level-up-features">
            <span className="eyebrow">Features gained</span>
            {plannedFeatures.map((feature) => <article key={feature.id ?? feature.name}><div className="level-up-feature-title"><strong>{feature.name}</strong>{featureOrigin(feature) && <small className="feature-origin">{featureOrigin(feature)}</small>}</div><p>{feature.description}</p></article>)}
            {!plannedFeatures.length && !needsSubclass && <p className="level-up-empty">No automatic class features are listed for this level. You can still adjust abilities, feats, and spells after advancing.</p>}
            {needsSubclass && <p className="level-up-warning">Choose a subclass in the character header before advancing; this level grants a subclass feature.</p>}
          </div>
          <div className="level-up-actions">
            <button className="button button-outline" onClick={() => setShowLevelUp(false)}>Cancel</button>
            <button className="button button-primary" disabled={needsSubclass || !advancementChoicesComplete || (hasAdvancementChoice && levelUpChoice === "feat" && !levelUpFeatId)} onClick={confirmLevelUp}><Sparkles size={15} />Apply level {plannedLevel}</button>
          </div>
        </section>
      </div>}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <div className={`drawer-scrim ${showLibrary || showRoster ? "visible" : ""}`} onClick={() => { setShowLibrary(false); setShowRoster(false); }} />
      {showLibrary && <ContentPackWorkshop packs={customPacks} disabledPackIds={disabledPackIds} bundledPackId={bundledPackId} onClose={() => setShowLibrary(false)} onImport={() => fileInput.current?.click()} onSave={saveContentPack} onRemove={removePack} onToggle={toggleContentPack} onExport={exportContentPack} />}
    </main>
  );
}
