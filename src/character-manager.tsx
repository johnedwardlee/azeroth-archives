"use client";

import {
  BookOpen,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileDown,
  FileJson,
  Heart,
  HardDrive,
  Flag,
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
import { FeatManager, InventoryManager, SpellbookManager } from "./living-sheet";
import { CombatManager, SKILLS } from "./combat-sheet";
import { ActionDashboard } from "./action-dashboard";
import { CreationGuide } from "./creation-guide";
import { SettingsPanel } from "./settings-panel";
import { DescriptionPicker } from "./description-picker";
import { AdvancementPanel } from "./advancement-panel";
import { CompanionManager } from "./companion-manager";
import { JournalManager } from "./journal-manager";
import { ContentPackWorkshop } from "./content-pack-workshop";
import { CampaignPanel } from "./campaign-panel";
import { Onboarding } from "./onboarding";
import { ReadinessPanel } from "./readiness-panel";
import { CollapsiblePanel, setVisiblePanelsExpanded } from "./collapsible-panel";
import { buildCharacterPdf, type CharacterPdfSection } from "./character-pdf";
import bundledWarcraftPackJson from "../content-packs/warcraft5e-campaign.w5e?raw";
import packageMetadata from "../package.json";
import { assertContentPack, contentPackValidationError } from "../lib/content-validation";
import { normalizeCampaignProfile, parseCampaignProfileFile, serializeCampaignProfile } from "../lib/campaign-profile";
import { evaluateCharacterReadiness } from "../lib/character-readiness";
import { createDmReviewExport } from "../lib/dm-review";
import {
  calculateArmorClass,
  calculateEffectiveSpeed,
  calculateEncumbrance,
  advancementPromptsForFeatures,
  classTrainingFor,
  METAMAGIC_OPTIONS,
  isEquipmentProficient,
  conditionEffectText,
  featAbilityIncrease,
  preparedSpellLimitFor,
  progressionSpellSlots,
  syncMulticlassResources,
  syncMulticlassSpellSlots,
  syncAutomaticResources,
  syncEffectConditions,
  syncProgressionSpellSlots,
  spellcastingAbilityForClass,
  startingHitPoints,
} from "../lib/character-rules";
import {
  ABILITY_LABELS,
  abilityModifier,
  proficiencyForLevel,
  type AbilityKey,
  type AdvancementChoice,
  type AncestryDefinition,
  type BackgroundDefinition,
  type AppRole,
  type AdvancementSnapshot,
  type CampaignProfile,
  type CharacterData,
  type CharacterClassLevel,
  type ClassDefinition,
  type ContentPack,
  type RulesFeature,
  type SpellcastingProfile,
} from "../lib/types";

type Tab = "encounter" | "character" | "spellbook" | "inventory" | "companions" | "journal";
export const CURRENT_STORE_VERSION = 5 as const;
export const CURRENT_CHARACTER_SCHEMA_VERSION = 6 as const;
export type OfflineStore = {
  version: 5;
  characters: CharacterData[];
  packs: ContentPack[];
  disabledPackIds: string[];
  campaignProfiles: CampaignProfile[];
  activeCampaignProfileId?: string;
  onboardingCompleted: boolean;
  appRole: AppRole;
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
    return { version: CURRENT_STORE_VERSION, characters: [], packs: [], disabledPackIds: [], campaignProfiles: [], onboardingCompleted: false, appRole: "player" };
  }
}

function writeBrowserStore(store: OfflineStore) {
  localStorage.setItem(browserStorageKey, JSON.stringify(store));
}

function downloadBlob(filename: string, blob: Blob) {
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
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
    featSpellcastingChoices: [],
    spellSlots: {},
    concentratingSpellId: undefined,
    activeEffects: [],
    companions: [],
    inventory: [],
    currency: { copper: 0, silver: 0, gold: 0 },
    resources: [],
    favoriteActionIds: [],
    recentActions: [],
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
    campaignProfileId: undefined,
    finalizedAt: undefined,
    readOnlyReview: false,
    reviewImportedAt: undefined,
    createdAt: now,
    updatedAt: now,
  };
}

function finiteNumber(value: unknown, fallback: number, minimum: number, maximum: number, integer = false) {
  const number = typeof value === "number" || typeof value === "string" ? Number(value) : Number.NaN;
  const safe = Number.isFinite(number) ? number : fallback;
  const clamped = Math.max(minimum, Math.min(maximum, safe));
  return integer ? Math.trunc(clamped) : clamped;
}

function textValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))] : [];
}

function abilityRecord(value: unknown, fallback: Record<AbilityKey, number>, minimum = 1, maximum = 30) {
  const source = value && typeof value === "object" ? value as Partial<Record<AbilityKey, unknown>> : {};
  return Object.fromEntries(abilityKeys.map((ability) => [ability, finiteNumber(source[ability], fallback[ability], minimum, maximum, true)])) as Record<AbilityKey, number>;
}

function normalizedClassLevels(value: unknown, legacyClassName: string, legacySubclassName: string, legacyLevel: number) {
  const merged = new Map<string, CharacterClassLevel>();
  if (Array.isArray(value)) {
    for (const candidate of value) {
      if (!candidate || typeof candidate !== "object") continue;
      const entry = candidate as Partial<CharacterClassLevel>;
      const className = textValue(entry.className).trim();
      if (!className) continue;
      const previous = merged.get(className);
      merged.set(className, {
        className,
        subclassName: textValue(entry.subclassName, previous?.subclassName ?? "").trim(),
        level: Math.min(20, (previous?.level ?? 0) + finiteNumber(entry.level, 1, 1, 20, true)),
      });
    }
  }
  if (!merged.size && legacyClassName) merged.set(legacyClassName, { className: legacyClassName, subclassName: legacySubclassName, level: legacyLevel });
  let remaining = 20;
  return [...merged.values()].flatMap((entry) => {
    if (remaining <= 0) return [];
    const level = Math.min(entry.level, remaining);
    remaining -= level;
    return [{ ...entry, level }];
  });
}

export function normalizeCharacter(value: Partial<CharacterData>): CharacterData {
  const defaults = newCharacter();
  const legacyLevel = finiteNumber(value.level, 1, 1, 20, true);
  const legacyClassName = textValue(value.className).trim();
  const legacySubclassName = textValue(value.subclassName).trim();
  const classLevels = normalizedClassLevels(value.classLevels, legacyClassName, legacySubclassName, legacyLevel);
  const totalLevel = classLevels.length ? classLevels.reduce((total, entry) => total + entry.level, 0) : legacyLevel;
  const maximumHitDice = totalLevel;
  const abilities = abilityRecord(value.abilities, defaults.abilities);
  const baseAbilities = abilityRecord(value.baseAbilities ?? value.abilities, defaults.baseAbilities);
  const maxHp = finiteNumber(value.maxHp, defaults.maxHp, 1, 9999, true);
  const normalized: CharacterData = {
    ...defaults,
    ...value,
    schemaVersion: CURRENT_CHARACTER_SCHEMA_VERSION,
    id: textValue(value.id, defaults.id).trim() || crypto.randomUUID(),
    name: textValue(value.name, defaults.name).trim() || defaults.name,
    playerName: textValue(value.playerName),
    ancestry: textValue(value.ancestry),
    className: classLevels[0]?.className || legacyClassName,
    background: textValue(value.background),
    experience: finiteNumber(value.experience, 0, 0, 99_999_999, true),
    currentHp: finiteNumber(value.currentHp, Math.min(defaults.currentHp, maxHp), 0, maxHp, true),
    maxHp,
    temporaryHp: finiteNumber(value.temporaryHp, 0, 0, 9999, true),
    armorClass: finiteNumber(value.armorClass, defaults.armorClass, 0, 99, true),
    speed: finiteNumber(value.speed, defaults.speed, 0, 999, true),
    proficiencyBonus: proficiencyForLevel(totalLevel),
    abilities,
    baseAbilities,
    abilityScoreMethod: (["standard-array", "point-buy", "rolled", "manual"] as const).includes(value.abilityScoreMethod ?? "manual") ? value.abilityScoreMethod ?? "manual" : "manual",
    backgroundAbilityBonuses: Object.fromEntries(abilityKeys.flatMap((ability) => {
      const bonus = value.backgroundAbilityBonuses?.[ability];
      return bonus === undefined ? [] : [[ability, finiteNumber(bonus, 0, -5, 5, true)]];
    })),
    portraitDataUrl: typeof value.portraitDataUrl === "string" && value.portraitDataUrl.startsWith("data:image/") ? value.portraitDataUrl : undefined,
    subclassName: classLevels[0]?.subclassName ?? legacySubclassName,
    classLevels,
    level: totalLevel,
    savingThrowProficiencies: stringList(value.savingThrowProficiencies).filter((ability): ability is AbilityKey => abilityKeys.includes(ability as AbilityKey)),
    skillProficiencies: stringList(value.skillProficiencies),
    skillExpertise: stringList(value.skillExpertise),
    classSkillChoices: stringList(value.classSkillChoices),
    languages: stringList(value.languages),
    toolProficiencies: stringList(value.toolProficiencies),
    armorProficiencies: stringList(value.armorProficiencies),
    weaponProficiencies: stringList(value.weaponProficiencies),
    weaponMasteries: stringList(value.weaponMasteries),
    advancementChoices: Array.isArray(value.advancementChoices) ? value.advancementChoices.filter((choice) => choice && typeof choice.featureName === "string" && Array.isArray(choice.selections)) : [],
    advancementHistory: Array.isArray(value.advancementHistory) ? value.advancementHistory.filter((entry) => entry && typeof entry.id === "string" && entry.before && typeof entry.before === "object") : [],
    abilityScoresConfirmed: Boolean(value.abilityScoresConfirmed),
    startingEquipmentConfirmed: Boolean(value.startingEquipmentConfirmed),
    startingEquipmentChoice: value.startingEquipmentChoice === "A" || value.startingEquipmentChoice === "B" ? value.startingEquipmentChoice : "",
    startingGold: finiteNumber(value.startingGold, 0, 0, 9_999_999, true),
    attacks: Array.isArray(value.attacks) ? value.attacks.filter((attack) => attack && typeof attack.name === "string").map((attack) => ({
      id: textValue(attack.id).trim() || crypto.randomUUID(), contentId: typeof attack.contentId === "string" ? attack.contentId : undefined, inventoryItemId: typeof attack.inventoryItemId === "string" ? attack.inventoryItemId : undefined,
      name: attack.name.trim() || "Attack", ability: abilityKeys.includes(attack.ability) ? attack.ability : "strength", proficient: Boolean(attack.proficient),
      bonus: finiteNumber(attack.bonus, 0, -99, 99, true), damage: textValue(attack.damage), damageType: textValue(attack.damageType), damageBonus: finiteNumber(attack.damageBonus, 0, -99, 99, true), notes: textValue(attack.notes),
    })) : [],
    features: Array.isArray(value.features) ? value.features.filter((feature) => feature && typeof feature.name === "string" && Boolean(feature.name.trim()) && typeof feature.description === "string") : [],
    feats: Array.isArray(value.feats) ? value.feats.filter((feat) => feat && typeof feat.id === "string" && Boolean(feat.id.trim()) && typeof feat.name === "string" && Boolean(feat.name.trim()) && typeof feat.category === "string" && typeof feat.description === "string") : [],
    spells: Array.isArray(value.spells) ? value.spells.filter((spell) => spell && typeof spell.id === "string" && typeof spell.name === "string" && Array.isArray(spell.classes)).map((spell) => {
      const sourceFeatId = typeof spell.sourceFeatId === "string" ? spell.sourceFeatId : undefined;
      const className = !sourceFeatId && typeof spell.className === "string" && classLevels.some((entry) => entry.className === spell.className)
        ? spell.className
        : !sourceFeatId ? classLevels.find((entry) => spell.classes.some((name) => typeof name === "string" && name.toLowerCase() === entry.className.toLowerCase()))?.className : undefined;
      const level = finiteNumber(spell.level, 0, 0, 9, true);
      return {
        id: spell.id.trim() || crypto.randomUUID(),
        name: spell.name.trim() || "Unnamed spell",
        aliases: stringList(spell.aliases),
        level,
        school: textValue(spell.school),
        classes: stringList(spell.classes),
        ritual: Boolean(spell.ritual),
        castingTime: textValue(spell.castingTime),
        range: textValue(spell.range),
        components: textValue(spell.components),
        duration: textValue(spell.duration),
        description: textValue(spell.description),
        source: typeof spell.source === "string" ? spell.source : undefined,
        prepared: level === 0 || Boolean(spell.prepared),
        ...(className ? { className } : {}),
        sourceFeatId,
        castingAbility: abilityKeys.includes(spell.castingAbility as AbilityKey) ? spell.castingAbility as AbilityKey : undefined,
      };
    }) : [],
    featSpellcastingChoices: Array.isArray(value.featSpellcastingChoices) ? value.featSpellcastingChoices.filter((choice) => choice && typeof choice.featId === "string").map((choice) => ({
      featId: choice.featId,
      spellList: textValue(choice.spellList),
      ability: abilityKeys.includes(choice.ability as AbilityKey) ? choice.ability as AbilityKey : undefined,
      cantripIds: stringList(choice.cantripIds).slice(0, 2),
      levelOneSpellId: typeof choice.levelOneSpellId === "string" ? choice.levelOneSpellId : undefined,
      freeCastUsed: Boolean(choice.freeCastUsed),
    })) : [],
    spellSlots: value.spellSlots && typeof value.spellSlots === "object" ? Object.fromEntries(Object.entries(value.spellSlots).flatMap(([level, slot]) => {
      if (!/^[1-9]$/.test(level) || !slot || typeof slot !== "object") return [];
      const maximum = finiteNumber(slot.maximum, 0, 0, 20, true);
      return [[level, { maximum, used: finiteNumber(slot.used, 0, 0, maximum, true) }]];
    })) : {},
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
    inventory: Array.isArray(value.inventory) ? value.inventory.filter((item) => item && typeof item.name === "string").map((item) => ({
      ...item,
      id: textValue(item.id).trim() || crypto.randomUUID(),
      name: item.name.trim() || "Item",
      category: typeof item.category === "string" ? item.category : undefined,
      quantity: finiteNumber(item.quantity, 1, 0, 999_999, true),
      equipped: Boolean(item.equipped),
      notes: textValue(item.notes),
      weight: typeof item.weight === "string" ? item.weight : undefined,
      cost: typeof item.cost === "string" ? item.cost : undefined,
      charges: item.charges === undefined ? undefined : Math.max(0, Number(item.charges) || 0),
      maximumCharges: item.maximumCharges === undefined ? undefined : Math.max(0, Number(item.maximumCharges) || 0),
      ammunition: item.ammunition === undefined ? undefined : Math.max(0, Number(item.ammunition) || 0),
      consumable: Boolean(item.consumable),
      attuned: Boolean(item.attuned),
      container: typeof item.container === "string" ? item.container : "",
      equipmentSlot: (["none", "main-hand", "off-hand", "two-hands", "armor", "worn"] as const).includes(item.equipmentSlot ?? "none") ? item.equipmentSlot : "none",
    })) : [],
    currency: {
      copper: finiteNumber(value.currency?.copper, 0, 0, 999_999_999, true),
      silver: finiteNumber(value.currency?.silver, 0, 0, 999_999_999, true),
      gold: finiteNumber(value.currency?.gold, 0, 0, 999_999_999, true),
    },
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
    favoriteActionIds: stringList(value.favoriteActionIds).slice(0, 24),
    recentActions: Array.isArray(value.recentActions) ? value.recentActions.filter((entry) => entry && typeof entry.actionId === "string" && typeof entry.name === "string").slice(0, 12).map((entry) => ({
      actionId: entry.actionId,
      name: entry.name.trim() || "Action",
      source: typeof entry.source === "string" ? entry.source : "Character",
      timing: (["action", "bonus", "reaction", "movement", "other", "passive"] as const).includes(entry.timing) ? entry.timing : "action",
      result: typeof entry.result === "string" ? entry.result : "Used",
      usedAt: typeof entry.usedAt === "string" ? entry.usedAt : new Date().toISOString(),
    })) : [],
    inspiration: Boolean(value.inspiration),
    hitDiceTotal: maximumHitDice,
    hitDiceUsed: finiteNumber(value.hitDiceUsed, 0, 0, maximumHitDice, true),
    hitDiceByClass: classLevels.map((entry, index) => { const stored = Array.isArray(value.hitDiceByClass) ? value.hitDiceByClass.find((pool) => pool && pool.className === entry.className) : undefined; return { className: entry.className, die: finiteNumber(stored?.die, 0, 0, 20, true), total: entry.level, used: finiteNumber(stored?.used, index === 0 ? value.hitDiceUsed ?? 0 : 0, 0, entry.level, true) }; }),
    deathSaveSuccesses: finiteNumber(value.deathSaveSuccesses, 0, 0, 3, true),
    deathSaveFailures: finiteNumber(value.deathSaveFailures, 0, 0, 3, true),
    conditions: stringList(value.conditions),
    exhaustionLevel: finiteNumber(value.exhaustionLevel, value.conditions?.includes("Exhaustion") ? 1 : 0, 0, 6, true),
    damageResistances: stringList(value.damageResistances),
    damageVulnerabilities: stringList(value.damageVulnerabilities),
    damageImmunities: stringList(value.damageImmunities),
    conditionImmunities: stringList(value.conditionImmunities),
    savingThrowBonuses: Object.fromEntries(abilityKeys.flatMap((ability) => { const bonus = value.savingThrowBonuses?.[ability]; return bonus === undefined ? [] : [[ability, finiteNumber(bonus, 0, -99, 99, true)]]; })),
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
    notes: textValue(value.notes),
    campaignProfileId: typeof value.campaignProfileId === "string" && value.campaignProfileId.trim() ? value.campaignProfileId.trim() : undefined,
    finalizedAt: typeof value.finalizedAt === "string" && value.finalizedAt.trim() ? value.finalizedAt : undefined,
    readOnlyReview: Boolean(value.readOnlyReview),
    reviewImportedAt: typeof value.reviewImportedAt === "string" && value.reviewImportedAt.trim() ? value.reviewImportedAt : undefined,
    createdAt: textValue(value.createdAt, defaults.createdAt),
    updatedAt: textValue(value.updatedAt, defaults.updatedAt),
  };
  const inventoryIds = new Set(normalized.inventory.map((item) => item.id));
  const assignedInventoryIds = new Set<string>();
  normalized.attacks = normalized.attacks.map((attack) => {
    const storedItemId = attack.inventoryItemId && inventoryIds.has(attack.inventoryItemId) ? attack.inventoryItemId : undefined;
    const inferredItemId = storedItemId ?? normalized.inventory.find((item) => item.contentId === attack.contentId && item.equipped && !assignedInventoryIds.has(item.id))?.id;
    if (inferredItemId) assignedInventoryIds.add(inferredItemId);
    if (inferredItemId) return { ...attack, inventoryItemId: inferredItemId };
    const withoutInventoryItem = { ...attack };
    delete withoutInventoryItem.inventoryItemId;
    return withoutInventoryItem;
  });
  normalized.conditions = syncEffectConditions(normalized.conditions, [], normalized.activeEffects);
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
    ? value as { version?: unknown; characters?: unknown; packs?: unknown; disabledPackIds?: unknown; campaignProfiles?: unknown; activeCampaignProfileId?: unknown; onboardingCompleted?: unknown; appRole?: unknown; recovery?: unknown }
    : {};
  const sourceVersion = Number.isInteger(parsed.version) ? Number(parsed.version) : 1;
  if (sourceVersion > CURRENT_STORE_VERSION) throw new Error("This character library was created by a newer version of Azeroth Archives.");

  let migrated = {
    version: Math.max(1, sourceVersion),
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    packs: Array.isArray(parsed.packs) ? parsed.packs : [],
    disabledPackIds: Array.isArray(parsed.disabledPackIds) ? parsed.disabledPackIds.filter((id): id is string => typeof id === "string") : [],
    campaignProfiles: Array.isArray(parsed.campaignProfiles) ? parsed.campaignProfiles : [],
    activeCampaignProfileId: typeof parsed.activeCampaignProfileId === "string" ? parsed.activeCampaignProfileId : undefined,
    onboardingCompleted: typeof parsed.onboardingCompleted === "boolean" ? parsed.onboardingCompleted : false,
    appRole: parsed.appRole === "dm" ? "dm" as const : "player" as const,
  };
  if (migrated.version === 1) migrated = { ...migrated, version: 2, packs: Array.isArray(migrated.packs) ? migrated.packs : [] };
  if (migrated.version === 2) migrated = { ...migrated, version: 3 };
  if (migrated.version === 3) migrated = { ...migrated, version: 4, disabledPackIds: [] };
  if (migrated.version === 4) migrated = { ...migrated, version: 5, campaignProfiles: [], activeCampaignProfileId: undefined, onboardingCompleted: migrated.characters.length > 0, appRole: "player" as const };

  const characters = Array.isArray(migrated.characters)
    ? migrated.characters.filter((item): item is Partial<CharacterData> => Boolean(item) && typeof item === "object").map(normalizeCharacter)
    : [];
  const packs = Array.isArray(migrated.packs)
    ? migrated.packs.filter((pack): pack is ContentPack => contentPackValidationError(pack) === null)
    : [];
  const campaignProfiles = Array.isArray(migrated.campaignProfiles) ? migrated.campaignProfiles.map(normalizeCampaignProfile) : [];
  const activeCampaignProfileId = campaignProfiles.some((profile) => profile.id === migrated.activeCampaignProfileId) ? migrated.activeCampaignProfileId : undefined;
  const recoverySource = parsed.recovery && typeof parsed.recovery === "object"
    ? parsed.recovery as { restoredFrom?: unknown; migrationBackup?: unknown }
    : undefined;
  const recovery = recoverySource
    ? {
        ...(typeof recoverySource.restoredFrom === "string" ? { restoredFrom: recoverySource.restoredFrom } : {}),
        ...(typeof recoverySource.migrationBackup === "string" ? { migrationBackup: recoverySource.migrationBackup } : {}),
      }
    : undefined;
  return { version: CURRENT_STORE_VERSION, characters, packs, disabledPackIds: migrated.disabledPackIds, campaignProfiles, activeCampaignProfileId, onboardingCompleted: Boolean(migrated.onboardingCompleted), appRole: migrated.appRole === "dm" ? "dm" : "player", ...(recovery ? { recovery } : {}) };
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
    feats: character.feats, spells: character.spells, featSpellcastingChoices: character.featSpellcastingChoices, features: character.features,
  });
}

export function CharacterManager() {
  const [characters, setCharacters] = useState<CharacterData[]>([]);
  const [character, setCharacter] = useState<CharacterData>(newCharacter);
  const [customPacks, setCustomPacks] = useState<ContentPack[]>([]);
  const [disabledPackIds, setDisabledPackIds] = useState<string[]>([]);
  const [campaignProfiles, setCampaignProfiles] = useState<CampaignProfile[]>([]);
  const [activeCampaignProfileId, setActiveCampaignProfileId] = useState<string | undefined>();
  const [onboardingCompleted, setOnboardingCompleted] = useState(true);
  const [appRole, setAppRole] = useState<AppRole>("player");
  const [storeLoaded, setStoreLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("character");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("Loading your roster…");
  const [saving, setSaving] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [showRoster, setShowRoster] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCampaigns, setShowCampaigns] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showCompletedSetup, setShowCompletedSetup] = useState(false);
  const [menuCharacterId, setMenuCharacterId] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpHpGain, setLevelUpHpGain] = useState(1);
  const [levelUpChoice, setLevelUpChoice] = useState<"abilities" | "feat">("abilities");
  const [levelUpAbilities, setLevelUpAbilities] = useState<[AbilityKey, AbilityKey]>(["strength", "stamina"]);
  const [levelUpFeatId, setLevelUpFeatId] = useState("");
  const [levelUpFeatAbility, setLevelUpFeatAbility] = useState<AbilityKey | "">("");
  const [levelUpSelections, setLevelUpSelections] = useState<Record<string, string[]>>({});
  const [levelUpClassName, setLevelUpClassName] = useState("");
  const [levelUpSubclassName, setLevelUpSubclassName] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<CharacterData | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const characterFileInput = useRef<HTMLInputElement>(null);
  const fullBackupFileInput = useRef<HTMLInputElement>(null);
  const campaignFileInput = useRef<HTMLInputElement>(null);
  const portraitFileInput = useRef<HTMLInputElement>(null);
  const characterRef = useRef(character);
  const deletedCharacterIds = useRef(new Set<string>());
  characterRef.current = character;

  const activeCampaignProfile = useMemo(() => campaignProfiles.find((profile) => profile.id === activeCampaignProfileId), [campaignProfiles, activeCampaignProfileId]);
  const characterCampaignProfile = useMemo(() => campaignProfiles.find((profile) => profile.id === character.campaignProfileId) ?? activeCampaignProfile, [campaignProfiles, character.campaignProfileId, activeCampaignProfile]);
  const enabledContent = useMemo(() => customPacks.filter((pack) => pack.pack.id === bundledPackId || !disabledPackIds.includes(pack.pack.id)), [customPacks, disabledPackIds]);
  const content = useMemo(() => enabledContent.filter((pack) => !characterCampaignProfile?.allowedPackIds.length || characterCampaignProfile.allowedPackIds.includes(pack.pack.id)), [enabledContent, characterCampaignProfile]);
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
  const selectedLevelUpFeat = hasAdvancementChoice && levelUpChoice === "feat" ? feats.find((feat) => feat.id === levelUpFeatId) : undefined;
  const levelUpFeatIncrease = featAbilityIncrease(selectedLevelUpFeat);
  const needsSubclass = !selectedLevelUpSubclass && Boolean(selectedLevelUpClass?.subclasses?.some((item) => (item.levelFeatures[String(plannedClassLevel)] ?? []).length));
  const advancementChoicesComplete = advancementPrompts.every((prompt) => {
    const selections = levelUpSelections[prompt.id] ?? [];
    return selections.length === prompt.count && selections.every(Boolean) && new Set(selections).size === selections.length;
  });
  const hitDicePools = useMemo(() => character.classLevels.map((entry, index) => {
    const stored = character.hitDiceByClass.find((pool) => pool.className === entry.className);
    return { className: entry.className, die: stored?.die || classes.find((definition) => definition.name === entry.className)?.hitDie || 8, total: stored?.total ?? entry.level, used: stored?.used ?? (index === 0 ? character.hitDiceUsed : 0) };
  }), [character.classLevels, character.hitDiceByClass, character.hitDiceUsed, classes]);
  const encumbrance = useMemo(() => calculateEncumbrance(character.inventory, character.abilities.strength, characterCampaignProfile?.encumbranceRule), [character.inventory, character.abilities.strength, characterCampaignProfile?.encumbranceRule]);
  const effectiveArmor = useMemo(() => calculateArmorClass(character, equipment), [character, equipment]);
  const effectiveSpeed = useMemo(() => calculateEffectiveSpeed(character, encumbrance, equipment), [character, encumbrance, equipment]);
  const spellcastingProfiles = useMemo(() => [...character.classLevels.flatMap((entry): SpellcastingProfile[] => {
    const ability = spellcastingAbilityForClass(entry.className, entry.subclassName ?? "", classes.find((definition) => definition.name === entry.className)?.primaryAbility);
    return ability ? [{ className: entry.className, ability, preparedLimit: preparedSpellLimitFor(entry.className, entry.subclassName ?? "", entry.level) }] : [];
  }), ...character.featSpellcastingChoices.flatMap((choice): SpellcastingProfile[] => choice.ability && choice.spellList ? [{ className: `Magic Initiate (${choice.spellList})`, ability: choice.ability, preparedLimit: null, sourceFeatId: choice.featId, spellList: choice.spellList }] : [])], [character.classLevels, character.featSpellcastingChoices, classes]);
  const readinessReport = useMemo(() => evaluateCharacterReadiness(character, {
    ancestries,
    classes,
    backgrounds,
    feats,
    spells,
    loadedPackIds: enabledContent.map((pack) => pack.pack.id),
    campaignProfile: characterCampaignProfile,
  }), [character, ancestries, classes, backgrounds, feats, enabledContent, characterCampaignProfile]);
  const creationLocked = Boolean(character.finalizedAt || character.readOnlyReview);
  const creationSetupVisible = !character.finalizedAt || showCompletedSetup;
  useEffect(() => {
    const load = window.azerothDesktop?.load() ?? Promise.resolve(readBrowserStore());
    load.then((store) => {
      const loadedCharacters = store.characters.map((item) => normalizeCharacter(item));
      setCharacters(loadedCharacters);
      if (loadedCharacters[0]) setCharacter(loadedCharacters[0]);
      setCustomPacks(withBundledPack(store.packs));
      setDisabledPackIds(store.disabledPackIds ?? []);
      setCampaignProfiles((store.campaignProfiles ?? []).map(normalizeCampaignProfile));
      setActiveCampaignProfileId(store.activeCampaignProfileId);
      setOnboardingCompleted(store.onboardingCompleted);
      setAppRole(store.appRole ?? "player");
      setShowOnboarding(!store.onboardingCompleted);
      setStoreLoaded(true);
      if (store.recovery?.restoredFrom) setStatus(`Recovered data from automatic backup ${store.recovery.restoredFrom}`);
      else if (store.recovery?.migrationBackup) setStatus(`Character data updated safely; backup saved as ${store.recovery.migrationBackup}`);
      else setStatus(store.characters.length ? "Saved on this device" : "Create your first hero");
    }).catch(() => { setStatus("Could not read local character data"); setStoreLoaded(true); });
  }, []);

  useEffect(() => {
    if (character.id === "draft") return;
    setCharacters((current) => current.map((item) => item.id === character.id ? character : item));
  }, [character]);

  useEffect(() => {
    setShowCompletedSetup(false);
    setTab(character.finalizedAt || character.readOnlyReview ? "encounter" : "character");
  }, [character.id, character.finalizedAt]);

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
    if (characterRef.current.readOnlyReview) {
      setStatus("DM review copies are read-only");
      return;
    }
    setCharacter((current) => {
      const nextLevel = patch.level ?? current.level;
      const nextFinalizedAt = "finalizedAt" in patch ? patch.finalizedAt : current.finalizedAt;
      const nextClassName = patch.className ?? current.className;
      const definition = classes.find((item) => item.name === nextClassName);
      let hpPatch: Partial<CharacterData> = {};
      if (patch.abilities && definition && nextLevel === 1 && !nextFinalizedAt) {
        const maxHp = startingHitPoints(definition.hitDie, patch.abilities.stamina);
        hpPatch = { maxHp, currentHp: maxHp };
      }
      return { ...current, ...patch, ...hpPatch, updatedAt: new Date().toISOString() };
    });
    setStatus("Unsaved changes");
  }

  function createCampaignDraft() {
    const profile = activeCampaignProfile;
    return normalizeCharacter({
      ...newCharacter(),
      campaignProfileId: profile?.id,
      experience: profile?.startingExperience ?? 0,
      abilityScoreMethod: profile?.allowedAbilityMethods[0] ?? "standard-array",
    });
  }

  async function persistCampaignState(nextProfiles: CampaignProfile[], nextActiveId: string | undefined, nextOnboardingCompleted = onboardingCompleted, nextRole = appRole) {
    const state = { campaignProfiles: nextProfiles, activeCampaignProfileId: nextActiveId, onboardingCompleted: nextOnboardingCompleted, appRole: nextRole };
    if (window.azerothDesktop) await window.azerothDesktop.saveCampaignState(state);
    else {
      const store = readBrowserStore();
      Object.assign(store, state);
      writeBrowserStore(store);
    }
    setCampaignProfiles(nextProfiles);
    setActiveCampaignProfileId(nextActiveId);
    setOnboardingCompleted(nextOnboardingCompleted);
    setAppRole(nextRole);
  }

  async function saveCampaignProfile(profile: CampaignProfile, activate = false) {
    try {
      const normalized = normalizeCampaignProfile(profile);
      const next = [normalized, ...campaignProfiles.filter((entry) => entry.id !== normalized.id)];
      const nextActive = activate ? normalized.id : activeCampaignProfileId;
      await persistCampaignState(next, nextActive);
      if (activate && character.id === "draft") setCharacter((current) => ({ ...current, campaignProfileId: normalized.id, experience: normalized.startingExperience, abilityScoreMethod: normalized.allowedAbilityMethods[0] }));
      setStatus(activate ? `${normalized.name} saved and activated` : `${normalized.name} saved`);
    } catch {
      setStatus("Campaign profile could not be saved");
    }
  }

  async function activateCampaignProfile(id?: string) {
    try {
      await persistCampaignState(campaignProfiles, id);
      if (character.id === "draft") setCharacter((current) => ({ ...current, campaignProfileId: id }));
      setStatus(id ? "Campaign profile activated" : "Active campaign profile cleared");
    } catch {
      setStatus("Campaign profile could not be activated");
    }
  }

  async function deleteCampaignProfile(id: string) {
    if (characters.some((entry) => entry.campaignProfileId === id) || character.campaignProfileId === id) {
      setStatus("That campaign profile is linked to a character and cannot be deleted");
      return;
    }
    const next = campaignProfiles.filter((entry) => entry.id !== id);
    try {
      await persistCampaignState(next, activeCampaignProfileId === id ? undefined : activeCampaignProfileId);
      setStatus("Campaign profile deleted");
    } catch {
      setStatus("Campaign profile could not be deleted");
    }
  }

  async function changeAppRole(role: AppRole) {
    try {
      await persistCampaignState(campaignProfiles, activeCampaignProfileId, onboardingCompleted, role);
      setStatus(role === "dm" ? "DM review mode enabled" : "Player mode enabled");
    } catch {
      setStatus("App role could not be saved");
    }
  }

  async function importCampaignProfile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const profile = parseCampaignProfileFile(JSON.parse(await file.text()));
      const next = [profile, ...campaignProfiles.filter((entry) => entry.id !== profile.id)];
      await persistCampaignState(next, profile.id);
      if (character.id === "draft") setCharacter((current) => ({ ...current, campaignProfileId: profile.id, experience: profile.startingExperience, abilityScoreMethod: profile.allowedAbilityMethods[0] }));
      setStatus(`${profile.name} imported and activated`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "That file is not a valid campaign profile");
    }
  }

  async function exportCampaignProfile(profile: CampaignProfile) {
    const contents = serializeCampaignProfile(profile);
    const safeName = profile.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "campaign";
    const filename = `${safeName}.azeroth-campaign.json`;
    if (window.azerothDesktop) {
      const destination = await window.azerothDesktop.saveJson(filename, contents);
      setStatus(destination ? "Campaign profile exported" : "Campaign profile export canceled");
    } else {
      downloadBlob(filename, new Blob([contents], { type: "application/json" }));
      setStatus("Campaign profile downloaded");
    }
  }

  async function finishOnboarding(role: AppRole, createCharacter: boolean) {
    try {
      await persistCampaignState(campaignProfiles, activeCampaignProfileId, true, role);
      setShowOnboarding(false);
      if (createCharacter) {
        setCharacter(createCampaignDraft());
        setShowRoster(false);
        setStatus("New character draft");
      } else {
        setShowRoster(true);
        setStatus("Import a player review file or configure the campaign");
      }
    } catch {
      setStatus("Welcome settings could not be saved");
    }
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
    const startingHp = selectedClass && character.level === 1 ? startingHitPoints(selectedClass.hitDie, character.abilities.stamina) : null;
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
      spells: character.spells.map((spell) => {
        if (spell.classes.some((className) => className.toLowerCase() === name.toLowerCase())) return { ...spell, className: name };
        const { className: _removedOwner, ...unownedSpell } = spell;
        return unownedSpell;
      }),
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
    const removedBackgroundFeatId = previousBackground?.featId && previousBackground.featId !== selectedBackground?.featId ? previousBackground.featId : undefined;
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
      feats: [...character.feats.filter((feat) => feat.id !== previousBackground?.featId || feat.id === selectedBackground?.featId), ...(selectedFeat && !character.feats.some((feat) => feat.id === selectedFeat.id) ? [selectedFeat] : [])],
      featSpellcastingChoices: removedBackgroundFeatId ? character.featSpellcastingChoices.filter((choice) => choice.featId !== removedBackgroundFeatId) : character.featSpellcastingChoices,
      spells: removedBackgroundFeatId ? character.spells.filter((spell) => spell.sourceFeatId !== removedBackgroundFeatId) : character.spells,
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
      readOnlyReview: false,
      reviewImportedAt: undefined,
      finalizedAt: undefined,
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

  async function finalizeCharacter() {
    if (!readinessReport.ready || character.readOnlyReview) return;
    if (readinessReport.warnings.length && !window.confirm(`Finalize with ${readinessReport.warnings.length} warning${readinessReport.warnings.length === 1 ? "" : "s"}? These items will remain listed for DM review.`)) return;
    const payload = normalizeCharacter({
      ...character,
      id: character.id === "draft" ? crypto.randomUUID() : character.id,
      campaignProfileId: character.campaignProfileId ?? activeCampaignProfile?.id,
      finalizedAt: new Date().toISOString(),
    });
    try {
      const saved = await persistCharacter(payload);
      setCharacter(saved);
      setCharacters((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      setTab("encounter");
      setStatus("Character finalized; creation choices are protected");
    } catch {
      setStatus("Character could not be finalized");
    }
  }

  function reopenCharacterCreation() {
    if (character.readOnlyReview || !window.confirm("Reopen character creation? Ancestry, class, background, ability assignments, and starting choices will become editable again.")) return;
    patchCharacter({ finalizedAt: undefined });
    setTab("character");
    setStatus("Character creation reopened");
  }

  async function exportDmReview() {
    try {
      setStatus("Preparing character for DM...");
      const payload = normalizeCharacter({ ...character, id: character.id === "draft" ? crypto.randomUUID() : character.id });
      const report = evaluateCharacterReadiness(payload, { ancestries, classes, backgrounds, feats, spells, loadedPackIds: enabledContent.map((pack) => pack.pack.id), campaignProfile: characterCampaignProfile });
      const saved = character.readOnlyReview ? payload : await persistCharacter(payload);
      if (!character.readOnlyReview) {
        setCharacter(saved);
        setCharacters((current) => [saved, ...current.filter((entry) => entry.id !== saved.id)]);
      }
      const review = createDmReviewExport(saved, report, characterCampaignProfile);
      if (window.azerothDesktop) {
        const destination = await window.azerothDesktop.saveReviewJson(review.filename, review.contents);
        setStatus(destination ? "DM review file saved" : "DM review export canceled");
      } else {
        downloadBlob(review.filename, new Blob([review.contents], { type: "application/json" }));
        setStatus("DM review file downloaded");
      }
    } catch {
      setStatus("DM review file could not be created");
    }
  }

  async function exportFullBackup() {
    try {
      setStatus("Saving current character before backup...");
      const payload = normalizeCharacter({ ...character, id: character.id === "draft" ? crypto.randomUUID() : character.id });
      const savedCharacter = await persistCharacter(payload);
      setCharacter(savedCharacter);
      setCharacters((current) => [savedCharacter, ...current.filter((item) => item.id !== savedCharacter.id)]);
      const store = window.azerothDesktop ? await window.azerothDesktop.load() : readBrowserStore();
      const backup = JSON.stringify({
        format: "azeroth-archives-full-backup",
        version: CURRENT_STORE_VERSION,
        exportedAt: new Date().toISOString(),
        store: {
          version: CURRENT_STORE_VERSION,
          characters: store.characters,
          packs: store.packs,
          disabledPackIds: store.disabledPackIds ?? [],
          campaignProfiles: store.campaignProfiles ?? [],
          activeCampaignProfileId: store.activeCampaignProfileId,
          onboardingCompleted: store.onboardingCompleted,
          appRole: store.appRole,
        },
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
      setCampaignProfiles(saved.campaignProfiles ?? []);
      setActiveCampaignProfileId(saved.activeCampaignProfileId);
      setOnboardingCompleted(saved.onboardingCompleted);
      setAppRole(saved.appRole);
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
      const reviewOnly = parsed.format === "azeroth-archives-dm-review";
      const imported = normalizeCharacter({ ...source, id: crypto.randomUUID(), createdAt: now, updatedAt: now, readOnlyReview: reviewOnly, reviewImportedAt: reviewOnly ? now : undefined });
      const saved = await persistCharacter(imported);
      setCharacters((current) => [saved, ...current]);
      setCharacter(saved);
      setShowRoster(false);
      setStatus(reviewOnly ? "DM review copy imported as read-only" : "Character imported as a new copy");
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
    setLevelUpFeatAbility("");
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
    if (!entry && characterCampaignProfile && !characterCampaignProfile.allowMulticlass) {
      setStatus("This campaign profile does not allow multiclassing");
      return;
    }
    setLevelUpClassName(name);
    setLevelUpSubclassName(entry?.subclassName ?? "");
    setLevelUpAbilities([definition.primaryAbility, "stamina"]);
    setLevelUpSelections({});
    setLevelUpFeatId("");
    setLevelUpFeatAbility("");
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
    const selectedFeat = selectedLevelUpFeat;
    if (hasAdvancementChoice && levelUpChoice === "feat" && (!selectedFeat || (levelUpFeatIncrease && !levelUpFeatAbility))) return;
    const abilities = { ...character.abilities };
    if (hasAdvancementChoice && levelUpChoice === "abilities") {
      for (const ability of levelUpAbilities) abilities[ability] = Math.min(20, abilities[ability] + 1);
    }
    if (levelUpFeatIncrease && levelUpFeatAbility) abilities[levelUpFeatAbility] = Math.min(levelUpFeatIncrease.maximum, abilities[levelUpFeatAbility] + 1);
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
    const chosenSpells = spells.filter((spell) => chosenSpellIds.includes(spell.id) && !character.spells.some((known) => known.id === spell.id)).map((spell) => ({ ...spell, prepared: true, className: selectedLevelUpClass.name }));
    const progressionSlots = syncMulticlassSpellSlots(character.spellSlots, classLevels);
    const hitDiceByClass = character.hitDiceByClass.some((pool) => pool.className === selectedLevelUpClass.name)
      ? character.hitDiceByClass.map((pool) => pool.className === selectedLevelUpClass.name ? { ...pool, die: selectedLevelUpClass.hitDie, total: pool.total + 1 } : pool)
      : [...character.hitDiceByClass, { className: selectedLevelUpClass.name, die: selectedLevelUpClass.hitDie, total: 1, used: 0 }];
    const summaryParts = [`+${levelUpHpGain} HP`];
    if (hasAdvancementChoice && levelUpChoice === "abilities") summaryParts.push(`Ability increase: ${levelUpAbilities.map((ability) => ABILITY_LABELS[ability]).join(" / ")}`);
    if (selectedFeat) summaryParts.push(`Feat: ${selectedFeat.name}`);
    if (levelUpFeatIncrease && levelUpFeatAbility) summaryParts.push(`Feat ability increase: ${ABILITY_LABELS[levelUpFeatAbility]}`);
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
    if (spellcastingProfiles.length) {
      const concentratingSpell = character.spells.find((spell) => spell.id === character.concentratingSpellId);
      addLivingSection("SPELLCASTING", spellcastingProfiles.map((profile) => { const spellAttack = abilityModifier(character.abilities[profile.ability]) + character.proficiencyBonus; return { name: `${profile.className} - ${ABILITY_LABELS[profile.ability]}`, detail: `Spell save DC ${8 + spellAttack} · Spell attack ${spellAttack >= 0 ? "+" : ""}${spellAttack}${concentratingSpell ? ` · Concentrating: ${concentratingSpell.name}` : ""}` }; }));
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

  async function buildPdfArtifact() {
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
        detail: `${spell.className ? `${spell.className} - ` : ""}${spell.level ? `Level ${spell.level}` : "Cantrip"} ${spell.school} - ${spell.castingTime} - ${spell.range} - ${spell.duration}`,
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
      ...(spellcastingProfiles.length ? [{
        title: "SPELLCASTING",
        icon: "spark" as const,
        rows: (() => {
          const concentratingSpell = character.spells.find((spell) => spell.id === character.concentratingSpellId);
          return spellcastingProfiles.map((profile) => { const attack = abilityModifier(character.abilities[profile.ability]) + character.proficiencyBonus; return { name: `${profile.className} - ${ABILITY_LABELS[profile.ability]}`, detail: `Spell save DC ${8 + attack} - Spell attack ${attack >= 0 ? "+" : ""}${attack}${concentratingSpell ? ` - Concentrating: ${concentratingSpell.name}` : ""}` }; });
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
    return { bytes, filename };
  }

  async function exportPdf() {
    setStatus("Building character sheet...");
    const { bytes, filename } = await buildPdfArtifact();
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
      <input ref={campaignFileInput} className="sr-only" type="file" accept=".json,application/json" onChange={importCampaignProfile} />
      <input ref={portraitFileInput} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={choosePortrait} />
      <header className="topbar">
        <button className="icon-button mobile-only" aria-label="Open roster" onClick={() => setShowRoster(true)}><Menu size={20} /></button>
        <div className="brand-mark" aria-hidden="true">A</div>
        <div className="brand-copy">
          <div className="brand-title-row"><strong>Azeroth Archives</strong><small className="app-version">v{packageMetadata.version}</small></div>
          <span>Offline Warcraft 5E character manager</span>
        </div>
        <div className="topbar-actions">
          <button className="button button-quiet" onClick={() => setShowCampaigns(true)}><Flag size={16} /><span>Campaigns</span>{activeCampaignProfile && <b>1</b>}</button>
          <button className="button button-quiet" onClick={() => setShowLibrary(true)}><LibraryBig size={16} /><span>Content library</span><b>{content.length}</b></button>
          <button className="button button-outline" onClick={exportPdf}><Download size={16} /><span>Export PDF</span></button>
          <button className="button button-primary" onClick={saveCharacter} disabled={saving || Boolean(character.readOnlyReview)}><Save size={16} />{saving ? "Saving" : "Save character"}</button>
          <button className="avatar-button" title="Settings, updates, and local data" aria-label="Open settings" onClick={() => setShowSettings(true)}><HardDrive size={19} /></button>
        </div>
      </header>

      <aside className={`roster-panel ${showRoster ? "is-open" : ""}`}>
        <div className="roster-heading"><div><span className="eyebrow">Your party</span><h2>Characters</h2></div><button className="icon-button mobile-only" onClick={() => setShowRoster(false)} aria-label="Close roster"><X size={18} /></button></div>
        <button className="button button-create" onClick={() => { setCharacter(createCampaignDraft()); setTab("character"); setShowRoster(false); setStatus("New character draft"); }}><Plus size={17} />Create character</button>
        <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a character" /></label>
        <div className="character-list">
          {visibleCharacters.map((item, index) => (
            <div key={item.id} className={`character-row ${item.id === character.id ? "active" : ""}`}>
              <button className="character-row-select" onClick={() => { setCharacter(item); setTab(item.finalizedAt || item.readOnlyReview ? "encounter" : "character"); setMenuCharacterId(null); setShowRoster(false); }}>
                <span className={`mini-portrait tone-${index % 4}`}>{item.portraitDataUrl ? <img src={item.portraitDataUrl} alt="" /> : initials(item.name)}</span>
                <span><strong>{item.name}{item.readOnlyReview ? " · Review" : item.finalizedAt ? " · Final" : ""}</strong><small>Level {item.level} {item.className}</small></span>
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

      <section className={`workspace ${character.readOnlyReview ? "review-readonly" : ""}`}>
        <div className="character-hero">
          <div className={`portrait-large ${character.portraitDataUrl ? "has-image" : ""}`}>
            {character.portraitDataUrl ? <img src={character.portraitDataUrl} alt={`${character.name || "Character"} portrait`} /> : <span>{initials(character.name)}</span>}
            <button disabled={Boolean(character.readOnlyReview)} aria-label={character.portraitDataUrl ? "Change portrait" : "Add portrait"} title={character.portraitDataUrl ? "Change portrait" : "Add portrait"} onClick={() => portraitFileInput.current?.click()}><Plus size={14} /></button>
          </div>
          <div className="hero-identity">
            <label className="eyebrow" htmlFor="character-name">Character name</label>
            <input id="character-name" className="name-input" disabled={creationLocked} value={character.name} onChange={(event) => patchCharacter({ name: event.target.value })} />
            <div className="identity-selects">
              <DescriptionPicker disabled={creationLocked} className="identity-picker" ariaLabel="Ancestry" value={character.ancestry} placeholder="Choose ancestry" onChange={applyAncestry} options={ancestries.map((item) => ({ value: item.name, label: item.name, meta: `${item.speed} ft. speed · ${item.traits.length} traits`, description: ancestryDescription(item) }))} />
              <i />
              <DescriptionPicker disabled={creationLocked} className="identity-picker" ariaLabel="Class" value={character.className} placeholder="Choose class" onChange={applyClass} options={classes.map((item) => ({ value: item.name, label: item.name, meta: `d${item.hitDie} Hit Die · ${ABILITY_LABELS[item.primaryAbility]}`, description: classDescription(item) }))} />
              <i />
              {!!subclasses.length && <><DescriptionPicker disabled={creationLocked} className="identity-picker" ariaLabel="Subclass" value={character.subclassName ?? ""} placeholder="Choose subclass" onChange={applySubclass} options={subclasses.map((item) => ({ value: item.name, label: item.name, meta: `${selectedClass?.name ?? "Class"} specialization`, description: item.description || Object.values(item.levelFeatures).flat().map((feature) => `${feature.name}: ${feature.description}`).join("\n\n") }))} /><i /></>}
              <DescriptionPicker disabled={creationLocked} className="identity-picker" ariaLabel="Background" value={character.background} placeholder="Choose background" onChange={applyBackground} options={backgrounds.map((item) => ({ value: item.name, label: item.name, meta: [item.skills.join(", "), item.featId?.replaceAll("-", " ")].filter(Boolean).join(" · "), description: backgroundDescription(item) }))} />
            </div>
          </div>
          <div className="level-card">
            <div><span>Level</span><strong>{character.level}</strong></div>
            <button className="button level-button" onClick={levelUp} disabled={character.level >= 20 || Boolean(character.readOnlyReview)}><Sparkles size={15} />Level up</button>
            <div className="xp-row"><span>{character.experience.toLocaleString()} XP</span><span>{nextLevelXp.toLocaleString()} XP</span></div>
            <div className="progress-track"><span style={{ width: `${xpProgress}%` }} /></div>
          </div>
        </div>

        <nav className="tabs" aria-label="Character sections">
          {(["encounter", "character", "spellbook", "inventory", "companions", "journal"] as Tab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}{item === "spellbook" && character.spells.length ? ` ${character.spells.length}` : ""}{item === "inventory" && character.inventory.length ? ` ${character.inventory.length}` : ""}{item === "companions" && character.companions.length ? ` ${character.companions.length}` : ""}</button>)}
        </nav>

        <div className="section-collapse-controls" aria-label="Section display controls">
          <span>Sections</span>
          <button type="button" onClick={() => setVisiblePanelsExpanded(true)}>Expand all</button>
          <button type="button" onClick={() => setVisiblePanelsExpanded(false)}>Collapse all</button>
        </div>

        {tab === "character" && (
          <div className="overview-grid">
            {creationSetupVisible && <ReadinessPanel key={`readiness-${character.id}`} characterId={character.id} report={readinessReport} finalizedAt={character.finalizedAt} readOnlyReview={character.readOnlyReview} campaignName={characterCampaignProfile?.name} onFinalize={finalizeCharacter} onReopen={reopenCharacterCreation} onExportReview={exportDmReview} />}
            <CollapsiblePanel className="vitals-panel" storageKey={`azeroth-panel-${character.id}-overview-vitals`} eyebrow="At a glance" title="Combat & vitals" summary={<span>{character.currentHp}/{character.maxHp} HP · AC {effectiveArmor.value}</span>}>
              <div className="vital-grid">
                <label><span><Heart size={15} />Hit points</span><div className="paired-input"><input type="number" value={character.currentHp} onChange={(event) => patchCharacter({ currentHp: Number(event.target.value) })} /><b>/</b><input type="number" value={character.maxHp} onChange={(event) => patchCharacter({ maxHp: Number(event.target.value) })} /></div><small>Current / Maximum</small></label>
                <label><span><Shield size={15} />Armor class</span><input className="stat-input" type="number" value={effectiveArmor.value} readOnly={effectiveArmor.automatic} onChange={(event) => patchCharacter({ armorClass: Number(event.target.value) })} /><small>{effectiveArmor.source}</small></label>
                <label><span><Zap size={15} />Effective speed</span><div className="unit-input"><input type="number" value={effectiveSpeed.value} readOnly={effectiveSpeed.effects.length > 0} onChange={(event) => patchCharacter({ speed: Number(event.target.value) })} /><b>ft</b></div><small>{effectiveSpeed.effects.length ? `Base ${character.speed} · ${effectiveSpeed.effects.join(" · ")}` : "Walking"}</small></label>
                <label><span><Swords size={15} />Proficiency</span><div className="static-stat">+{character.proficiencyBonus}</div><small>Level based</small></label>
              </div>
            </CollapsiblePanel>

            <CollapsiblePanel className="abilities-panel" storageKey={`azeroth-panel-${character.id}-overview-abilities`} eyebrow="Core scores" title="Abilities" summary={<span>6 scores · modifiers included</span>}>
              <div className="ability-grid">
                {abilityKeys.map((key) => (
                  <label key={key} className="ability-card"><span>{ABILITY_LABELS[key]}</span><input disabled={creationLocked} type="number" value={character.abilities[key]} onChange={(event) => updateAbility(key, Number(event.target.value))} /><strong>{modifierLabel(character.abilities[key])}</strong></label>
                ))}
              </div>
            </CollapsiblePanel>

            <CollapsiblePanel className="details-panel" storageKey={`azeroth-panel-${character.id}-overview-details`} eyebrow="Identity" title="Character details" summary={<span>{character.playerName || "Player not set"} · {character.experience.toLocaleString()} XP</span>}>
              <div className="form-grid">
                <label><span>Player name</span><input value={character.playerName} onChange={(event) => patchCharacter({ playerName: event.target.value })} placeholder="Your name" /></label>
                <label><span>Experience points</span><input type="number" min="0" value={character.experience} onChange={(event) => patchCharacter({ experience: Math.max(0, Number(event.target.value)) })} /></label>
              </div>
              <div className="feature-preview">
                <div><span className="eyebrow">Recently gained</span><h3>{resolvedFeatures.at(-1)?.name ?? "Ready for adventure"}</h3>{resolvedFeatures.at(-1) && featureOrigin(resolvedFeatures.at(-1)!) && <small className="feature-origin">Granted by {featureOrigin(resolvedFeatures.at(-1)!)}</small>}<p>{resolvedFeatures.at(-1)?.description ?? "Add features through your ancestry, class, or an imported content pack."}</p></div>
                <button className="text-button" onClick={() => document.getElementById("character-features")?.scrollIntoView({ behavior: "smooth", block: "start" })}>View all features <span>→</span></button>
              </div>
            </CollapsiblePanel>
            {creationSetupVisible && <CreationGuide key={`creation-guide-${character.id}`} character={character} patchCharacter={patchCharacter} background={selectedBackground} feats={feats} equipment={equipment} campaignProfile={characterCampaignProfile} locked={creationLocked} />}
            <AdvancementPanel character={character} onRollback={rollbackLatestAdvancement} />
          </div>
        )}

        {tab === "character" && (
          <div className="stacked-tab-panels" id="character-features">
          <FeatManager catalog={feats} character={character} patchCharacter={patchCharacter} />
          <CollapsiblePanel className="wide-panel" storageKey={`azeroth-panel-${character.id}-features-traits`} eyebrow="Rules reference" title="Features & traits" summary={<span>{resolvedFeatures.length} entries</span>}>
            <div className="feature-list">
              {resolvedFeatures.map((feature, index) => <article key={`${feature.name}-${index}`}><span>{String(index + 1).padStart(2, "0")}</span><div><div className="feature-title-row"><h3>{feature.name}</h3>{featureOrigin(feature) && <small className="feature-origin">{featureOrigin(feature)}</small>}</div><p>{feature.description}</p></div></article>)}
              {!character.features.length && <div className="empty-state">No features yet. Choose an ancestry and class or import a content pack.</div>}
            </div>
          </CollapsiblePanel>
          </div>
        )}

        {tab === "encounter" && <ActionDashboard character={character} patchCharacter={patchCharacter} catalog={equipment} hitDicePools={hitDicePools} encumbranceRule={characterCampaignProfile?.encumbranceRule} />}

        {tab === "character" && <CombatManager catalog={equipment} character={character} patchCharacter={patchCharacter} />}

          {tab === "spellbook" && <SpellbookManager catalog={spells} equipmentCatalog={equipment} character={character} patchCharacter={patchCharacter} spellcastingProfiles={spellcastingProfiles} creationLocked={creationLocked} showCreationSetup={creationSetupVisible} />}

        {tab === "inventory" && <InventoryManager catalog={equipment} character={character} patchCharacter={patchCharacter} encumbranceRule={characterCampaignProfile?.encumbranceRule} attunementLimit={characterCampaignProfile?.attunementLimit} />}

        {tab === "companions" && <CompanionManager catalog={creatures} character={character} patchCharacter={patchCharacter} />}

        {tab === "journal" && <JournalManager character={character} patchCharacter={patchCharacter} />}

        {character.finalizedAt && <div className="completed-setup-toggle completed-setup-toggle-bottom"><div><strong>Character setup complete</strong><span>Session-zero and creation choices are hidden during regular play.</span></div><button type="button" className="button button-outline" aria-expanded={showCompletedSetup} onClick={() => setShowCompletedSetup((current) => !current)}>{showCompletedSetup ? <EyeOff size={15} /> : <Eye size={15} />}{showCompletedSetup ? "Hide setup" : "Show setup"}</button></div>}
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
            <label><span>Advance class</span><select value={selectedLevelUpClass?.name ?? ""} onChange={(event) => changeLevelUpClass(event.target.value)}>{classes.map((definition) => <option disabled={Boolean(characterCampaignProfile && !characterCampaignProfile.allowMulticlass && !character.classLevels.some((entry) => entry.className === definition.name))} key={definition.id} value={definition.name}>{definition.name}{character.classLevels.some((entry) => entry.className === definition.name) ? ` (level ${character.classLevels.find((entry) => entry.className === definition.name)?.level})` : " (new class)"}</option>)}</select></label>
            <div><span>Class level</span><strong>{plannedClassLevel}</strong></div>
            <div><span>Proficiency</span><strong>+{proficiencyForLevel(plannedLevel)}</strong></div>
            <label><span>Hit points gained</span><input type="number" min="1" max="99" value={levelUpHpGain} onChange={(event) => setLevelUpHpGain(Math.max(1, Math.min(99, Number(event.target.value) || 1)))} /></label>
          </div>
          {!!selectedLevelUpClass?.subclasses?.length && <label className="level-up-subclass"><span>Specialization</span><select value={selectedLevelUpSubclass?.name ?? ""} onChange={(event) => { setLevelUpSubclassName(event.target.value); setLevelUpSelections({}); }}><option value="">Choose when granted</option>{selectedLevelUpClass.subclasses.map((subclass) => <option key={subclass.id} value={subclass.name}>{subclass.name}</option>)}</select><small>A specialization is required when this class level grants its first specialization feature.</small></label>}
          {hasAdvancementChoice && <div className="advancement-choice">
            <span className="eyebrow">Ability Score Improvement choice</span>
            <div className="advancement-choice-tabs"><button className={levelUpChoice === "abilities" ? "active" : ""} onClick={() => setLevelUpChoice("abilities")}>Increase abilities</button><button disabled={characterCampaignProfile?.allowOptionalFeats === false} className={levelUpChoice === "feat" ? "active" : ""} onClick={() => setLevelUpChoice("feat")}>Choose a feat</button></div>
            {levelUpChoice === "abilities" ? <div className="advancement-abilities">
              <label>First +1<select value={levelUpAbilities[0]} onChange={(event) => setLevelUpAbilities([event.target.value as AbilityKey, levelUpAbilities[1]])}>{abilityKeys.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]} ({character.abilities[ability]})</option>)}</select></label>
              <label>Second +1<select value={levelUpAbilities[1]} onChange={(event) => setLevelUpAbilities([levelUpAbilities[0], event.target.value as AbilityKey])}>{abilityKeys.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]} ({character.abilities[ability]})</option>)}</select></label>
              <small>Select the same ability twice for +2. Ability Score Improvements cannot raise a score above 20.</small>
            </div> : <div className="advancement-feat"><label>Feat<select value={levelUpFeatId} onChange={(event) => { const id = event.target.value; const increase = featAbilityIncrease(feats.find((feat) => feat.id === id)); setLevelUpFeatId(id); setLevelUpFeatAbility(increase?.options[0] ?? ""); }}><option value="">Choose an eligible feat</option>{feats.filter((feat) => !character.feats.some((known) => known.id === feat.id)).map((feat) => <option key={feat.id} value={feat.id}>{feat.name}{feat.prerequisite ? ` — ${feat.prerequisite}` : ""}</option>)}</select></label>{levelUpFeatIncrease && <label>Feat ability +1<select value={levelUpFeatAbility} onChange={(event) => setLevelUpFeatAbility(event.target.value as AbilityKey)}>{levelUpFeatIncrease.options.map((ability) => <option key={ability} value={ability}>{ABILITY_LABELS[ability]} ({character.abilities[ability]} → {Math.min(levelUpFeatIncrease.maximum, character.abilities[ability] + 1)})</option>)}</select></label>}<small>Prerequisites are shown for review; the app does not override the GM’s eligibility ruling.</small></div>}
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
            <button className="button button-primary" disabled={needsSubclass || !advancementChoicesComplete || (hasAdvancementChoice && levelUpChoice === "feat" && (!levelUpFeatId || Boolean(levelUpFeatIncrease && !levelUpFeatAbility)))} onClick={confirmLevelUp}><Sparkles size={15} />Apply level {plannedLevel}</button>
          </div>
        </section>
      </div>}

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      <div className={`drawer-scrim ${showLibrary || showRoster || showCampaigns ? "visible" : ""}`} onClick={() => { setShowLibrary(false); setShowRoster(false); setShowCampaigns(false); }} />
      {showLibrary && <ContentPackWorkshop packs={customPacks} disabledPackIds={disabledPackIds} bundledPackId={bundledPackId} onClose={() => setShowLibrary(false)} onImport={() => fileInput.current?.click()} onSave={saveContentPack} onRemove={removePack} onToggle={toggleContentPack} onExport={exportContentPack} />}
      {showCampaigns && <CampaignPanel profiles={campaignProfiles} activeProfileId={activeCampaignProfileId} packs={customPacks} appRole={appRole} onClose={() => setShowCampaigns(false)} onSave={saveCampaignProfile} onActivate={activateCampaignProfile} onDelete={deleteCampaignProfile} onImport={() => campaignFileInput.current?.click()} onExport={exportCampaignProfile} onRoleChange={changeAppRole} onShowWelcome={() => { setShowCampaigns(false); setShowOnboarding(true); }} />}
      {storeLoaded && showOnboarding && <Onboarding activeCampaignName={activeCampaignProfile?.name} onImportCampaign={() => campaignFileInput.current?.click()} onFinish={finishOnboarding} />}
    </main>
  );
}
