import type { AbilityScoreMethod, CampaignProfile, EncumbranceRule, StartingEquipmentRule } from "./types";

export const CAMPAIGN_PROFILE_FORMAT = "azeroth-archives-campaign-profile" as const;
export const CAMPAIGN_PROFILE_VERSION = 1 as const;
export const ABILITY_SCORE_METHODS: AbilityScoreMethod[] = ["standard-array", "point-buy", "rolled", "manual"];
export const ENCUMBRANCE_RULES: EncumbranceRule[] = ["variant", "standard", "none"];
export const STARTING_EQUIPMENT_RULES: StartingEquipmentRule[] = ["packages-or-gold", "packages-only", "gold-only"];

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `campaign-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.trunc(parsed))) : fallback;
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim()).filter(Boolean))]
    : [];
}

export function newCampaignProfile(packIds: string[] = []): CampaignProfile {
  const now = new Date().toISOString();
  return {
    schemaVersion: CAMPAIGN_PROFILE_VERSION,
    id: id(),
    name: "My Warcraft Campaign",
    startingLevel: 1,
    startingExperience: 0,
    allowedPackIds: strings(packIds),
    allowedAbilityMethods: ["standard-array", "point-buy", "rolled", "manual"],
    encumbranceRule: "variant",
    startingEquipmentRule: "packages-or-gold",
    allowMulticlass: true,
    allowOptionalFeats: true,
    attunementLimit: 3,
    houseRules: "",
    createdAt: now,
    updatedAt: now,
  };
}

export function normalizeCampaignProfile(value: unknown): CampaignProfile {
  const source = value && typeof value === "object" ? value as Partial<CampaignProfile> : {};
  const defaults = newCampaignProfile();
  const methods = strings(source.allowedAbilityMethods).filter((method): method is AbilityScoreMethod => ABILITY_SCORE_METHODS.includes(method as AbilityScoreMethod));
  return {
    schemaVersion: CAMPAIGN_PROFILE_VERSION,
    id: typeof source.id === "string" && source.id.trim() ? source.id.trim() : defaults.id,
    name: typeof source.name === "string" && source.name.trim() ? source.name.trim() : defaults.name,
    startingLevel: integer(source.startingLevel, 1, 1, 20),
    startingExperience: integer(source.startingExperience, 0, 0, 99_999_999),
    allowedPackIds: strings(source.allowedPackIds),
    allowedAbilityMethods: methods.length ? methods : defaults.allowedAbilityMethods,
    encumbranceRule: ENCUMBRANCE_RULES.includes(source.encumbranceRule as EncumbranceRule) ? source.encumbranceRule as EncumbranceRule : defaults.encumbranceRule,
    startingEquipmentRule: STARTING_EQUIPMENT_RULES.includes(source.startingEquipmentRule as StartingEquipmentRule) ? source.startingEquipmentRule as StartingEquipmentRule : defaults.startingEquipmentRule,
    allowMulticlass: source.allowMulticlass !== false,
    allowOptionalFeats: source.allowOptionalFeats !== false,
    attunementLimit: integer(source.attunementLimit, 3, 0, 10),
    houseRules: typeof source.houseRules === "string" ? source.houseRules : "",
    createdAt: typeof source.createdAt === "string" ? source.createdAt : defaults.createdAt,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : defaults.updatedAt,
  };
}

export function parseCampaignProfileFile(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("Campaign profile data must be an object.");
  const source = value as { format?: unknown; version?: unknown; profile?: unknown };
  if (source.format !== CAMPAIGN_PROFILE_FORMAT || source.version !== CAMPAIGN_PROFILE_VERSION || !source.profile) {
    throw new Error("That file is not an Azeroth Archives campaign profile.");
  }
  return normalizeCampaignProfile(source.profile);
}

export function serializeCampaignProfile(profile: CampaignProfile) {
  return JSON.stringify({
    format: CAMPAIGN_PROFILE_FORMAT,
    version: CAMPAIGN_PROFILE_VERSION,
    exportedAt: new Date().toISOString(),
    profile: normalizeCampaignProfile(profile),
  }, null, 2);
}
