import type {
  CharacterData,
  CharacterSyncLink,
  CharacterMutation,
  MutationCategory,
  RollEventCategory,
  SharedRollEvent,
  SyncOutboxEntry,
} from "./types";

export type DmMutationIntent =
  | "view"
  | "add-inventory-item"
  | "add-known-spell"
  | "adjust-current-resource"
  | "adjust-condition"
  | "full-character-edit"
  | "remove-inventory-item"
  | "remove-known-spell"
  | "unlink-character";

export type DmMutationGuard = "always" | "edit-toggle" | "confirmation";
export type LocalRollEvent = Omit<SharedRollEvent, "kind" | "id" | "campaignId" | "characterId" | "actorName" | "createdAt" | "hidden"> & { hidden?: boolean };

const mutationDomains: Partial<Record<keyof CharacterData, MutationCategory>> = {
  currentHp: "vitals",
  maxHp: "vitals",
  temporaryHp: "vitals",
  armorClass: "vitals",
  speed: "vitals",
  inspiration: "vitals",
  deathSaveSuccesses: "vitals",
  deathSaveFailures: "vitals",
  conditions: "vitals",
  exhaustionLevel: "vitals",
  resources: "resource",
  hitDiceTotal: "resource",
  hitDiceUsed: "resource",
  hitDiceByClass: "resource",
  spellSlots: "resource",
  inventory: "inventory",
  currency: "inventory",
  attacks: "combat",
  damageResistances: "combat",
  damageVulnerabilities: "combat",
  damageImmunities: "combat",
  conditionImmunities: "combat",
  savingThrowBonuses: "combat",
  spells: "spells",
  featSpellcastingChoices: "spells",
  concentratingSpellId: "spells",
  activeEffects: "spells",
  name: "identity",
  playerName: "identity",
  ancestry: "identity",
  className: "identity",
  subclassName: "identity",
  classLevels: "advancement",
  background: "identity",
  level: "advancement",
  experience: "advancement",
  proficiencyBonus: "advancement",
  abilities: "advancement",
  baseAbilities: "advancement",
  backgroundAbilityBonuses: "advancement",
  advancementChoices: "advancement",
  advancementHistory: "advancement",
  features: "features",
  feats: "features",
  journal: "journal",
  notes: "journal",
  companions: "companions",
  favoriteActionIds: "preferences",
  recentActions: "preferences",
};

export function mutationCategoryForPatch(patch: Partial<CharacterData>): MutationCategory {
  const categories = new Set(
    (Object.keys(patch) as Array<keyof CharacterData>)
      .filter((key) => key !== "updatedAt")
      .map((key) => mutationDomains[key] ?? "other"),
  );
  return categories.size === 1 ? [...categories][0] : "other";
}

export function dmMutationGuard(intent: DmMutationIntent): DmMutationGuard {
  if (intent === "unlink-character") return "confirmation";
  if (["full-character-edit", "remove-inventory-item", "remove-known-spell"].includes(intent)) return "edit-toggle";
  return "always";
}

export function sanitizeCharacterForSync(character: CharacterData): CharacterData {
  const sanitized = { ...character };
  delete sanitized.portraitDataUrl;
  delete sanitized.readOnlyReview;
  delete sanitized.reviewImportedAt;
  return sanitized;
}

export function sanitizeCharacterPatch(patch: Partial<CharacterData>): Partial<CharacterData> {
  const sanitized = { ...patch };
  delete sanitized.id;
  delete sanitized.portraitDataUrl;
  delete sanitized.readOnlyReview;
  delete sanitized.reviewImportedAt;
  for (const key of Object.keys(sanitized) as Array<keyof CharacterData>) {
    if (sanitized[key] === undefined) (sanitized as Record<string, unknown>)[key] = null;
  }
  return sanitized;
}

export function createCharacterMutation(
  campaignId: string,
  characterId: string,
  baseRevision: number,
  patch: Partial<CharacterData>,
  options: { id?: string; createdAt?: string; debounceKey?: string; deferredUntil?: string } = {},
): CharacterMutation {
  const sanitized = sanitizeCharacterPatch(patch);
  return {
    kind: "character-mutation",
    id: options.id ?? crypto.randomUUID(),
    campaignId,
    characterId,
    baseRevision,
    category: mutationCategoryForPatch(sanitized),
    patch: sanitized,
    ...(options.debounceKey ? { debounceKey: options.debounceKey } : {}),
    ...(options.deferredUntil ? { deferredUntil: options.deferredUntil } : {}),
    createdAt: options.createdAt ?? new Date().toISOString(),
  };
}

export function createSharedRollEvent(input: {
  campaignId: string;
  characterId: string;
  actorName: string;
  category: RollEventCategory;
  label: string;
  formula?: string;
  dice: number[];
  modifier?: number;
  total: number;
  mode?: SharedRollEvent["mode"];
  detail?: string;
  hidden?: boolean;
  id?: string;
  createdAt?: string;
}): SharedRollEvent {
  return {
    kind: "roll-event",
    id: input.id ?? crypto.randomUUID(),
    campaignId: input.campaignId,
    characterId: input.characterId,
    actorName: input.actorName.trim() || "Unknown player",
    category: input.category,
    label: input.label.trim() || "Roll",
    formula: input.formula?.trim() ?? "",
    dice: input.dice.map((die) => Math.trunc(die)),
    modifier: Math.trunc(input.modifier ?? 0),
    total: Math.trunc(input.total),
    mode: input.mode ?? "normal",
    detail: input.detail?.trim() ?? "",
    hidden: Boolean(input.hidden),
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function enqueueSyncEntry(outbox: SyncOutboxEntry[], entry: SyncOutboxEntry) {
  if (entry.kind === "character-mutation" && entry.debounceKey) {
    let existingIndex = -1;
    for (let index = outbox.length - 1; index >= 0; index -= 1) {
      const queued = outbox[index];
      if (queued.kind === "character-mutation" && queued.campaignId === entry.campaignId && queued.characterId === entry.characterId && queued.debounceKey === entry.debounceKey) { existingIndex = index; break; }
    }
    if (existingIndex >= 0) {
      const existing = outbox[existingIndex] as CharacterMutation;
      const merged: CharacterMutation = {
        ...existing,
        baseRevision: entry.baseRevision,
        category: mutationCategoryForPatch({ ...existing.patch, ...entry.patch }),
        patch: { ...existing.patch, ...entry.patch },
        deferredUntil: entry.deferredUntil,
      };
      return outbox.map((queued, index) => index === existingIndex ? merged : queued).sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    }
  }
  return outbox.some((queued) => queued.id === entry.id) ? outbox : [...outbox, entry].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function acknowledgeSyncEntry(outbox: SyncOutboxEntry[], entryId: string) {
  return outbox.filter((entry) => entry.id !== entryId);
}

export function removeCharacterSyncState(
  links: CharacterSyncLink[],
  outbox: SyncOutboxEntry[],
  campaignId: string,
  characterId: string,
) {
  return {
    links: links.filter((link) => !(link.campaignId === campaignId && link.characterId === characterId)),
    outbox: outbox.filter((entry) => !(entry.campaignId === campaignId && entry.characterId === characterId)),
  };
}

export function mergeRemoteCharacter(local: CharacterData, remote: CharacterData): CharacterData {
  return {
    ...local,
    ...sanitizeCharacterForSync(remote),
    portraitDataUrl: local.portraitDataUrl,
    readOnlyReview: false,
    reviewImportedAt: undefined,
  };
}
