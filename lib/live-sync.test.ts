import { describe, expect, it } from "vitest";
import {
  acknowledgeSyncEntry,
  createCharacterMutation,
  createSharedRollEvent,
  dmMutationGuard,
  enqueueSyncEntry,
  mergeRemoteCharacter,
  mutationCategoryForPatch,
  removeCharacterSyncState,
  sanitizeCharacterForSync,
  sanitizeCharacterPatch,
} from "./live-sync";
import type { CharacterData } from "./types";

const character = {
  id: "hero-id",
  name: "Jaina",
  playerName: "Player",
  portraitDataUrl: "data:image/png;base64,portrait",
  readOnlyReview: true,
  reviewImportedAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
} as CharacterData;

describe("live sync protocol", () => {
  it("categorizes single-domain patches and treats mixed patches as other", () => {
    expect(mutationCategoryForPatch({ currentHp: 10, temporaryHp: 2 })).toBe("vitals");
    expect(mutationCategoryForPatch({ spellSlots: {} })).toBe("resource");
    expect(mutationCategoryForPatch({ inventory: [], currentHp: 10 })).toBe("other");
  });

  it("implements the approved DM mutation guard", () => {
    expect(dmMutationGuard("add-inventory-item")).toBe("always");
    expect(dmMutationGuard("add-known-spell")).toBe("always");
    expect(dmMutationGuard("adjust-current-resource")).toBe("always");
    expect(dmMutationGuard("adjust-condition")).toBe("always");
    expect(dmMutationGuard("full-character-edit")).toBe("edit-toggle");
    expect(dmMutationGuard("remove-inventory-item")).toBe("edit-toggle");
    expect(dmMutationGuard("unlink-character")).toBe("confirmation");
  });

  it("removes local-only and review-only fields before publishing", () => {
    expect(sanitizeCharacterForSync(character)).toMatchObject({ id: "hero-id", name: "Jaina" });
    expect(sanitizeCharacterForSync(character)).not.toHaveProperty("portraitDataUrl");
    expect(sanitizeCharacterForSync(character)).not.toHaveProperty("readOnlyReview");
  });

  it("preserves optional-field clearing across JSON transport", () => {
    const patch = sanitizeCharacterPatch({ concentratingSpellId: undefined, subclassName: undefined, activeEffects: [] });
    expect(patch).toEqual({ concentratingSpellId: null, subclassName: null, activeEffects: [] });
    expect(JSON.parse(JSON.stringify(patch))).toEqual(patch);
  });

  it("creates deterministic testable mutation and roll envelopes", () => {
    expect(createCharacterMutation("campaign", "hero-id", 4, { currentHp: 7 }, { id: "mutation", createdAt: "2026-08-24T01:00:00.000Z" })).toEqual({
      kind: "character-mutation",
      id: "mutation",
      campaignId: "campaign",
      characterId: "hero-id",
      baseRevision: 4,
      category: "vitals",
      patch: { currentHp: 7 },
      createdAt: "2026-08-24T01:00:00.000Z",
    });
    expect(createSharedRollEvent({ campaignId: "campaign", characterId: "hero-id", actorName: " Player ", category: "attack", label: " Sword ", dice: [17], modifier: 6, total: 23, id: "roll", createdAt: "2026-08-24T01:01:00.000Z" })).toMatchObject({ id: "roll", actorName: "Player", label: "Sword", total: 23, hidden: false });
    expect(createSharedRollEvent({ campaignId: "campaign", characterId: "hero-id", actorName: "DM", category: "other", label: "Secret", dice: [4], total: 4, hidden: true })).toMatchObject({ actorName: "DM", hidden: true });
  });

  it("keeps the outbox ordered and idempotent", () => {
    const later = createCharacterMutation("campaign", "hero-id", 1, { currentHp: 6 }, { id: "later", createdAt: "2026-08-24T02:00:00.000Z" });
    const earlier = createCharacterMutation("campaign", "hero-id", 1, { currentHp: 8 }, { id: "earlier", createdAt: "2026-08-24T01:00:00.000Z" });
    const queued = enqueueSyncEntry(enqueueSyncEntry(enqueueSyncEntry([], later), earlier), earlier);
    expect(queued.map((entry) => entry.id)).toEqual(["earlier", "later"]);
    expect(acknowledgeSyncEntry(queued, "earlier").map((entry) => entry.id)).toEqual(["later"]);
  });

  it("coalesces debounced journal edits into one durable outbox mutation", () => {
    const first = createCharacterMutation("campaign", "hero-id", 1, { notes: "F" }, { id: "first", createdAt: "2026-08-24T01:00:00.000Z", debounceKey: "journal:hero-id", deferredUntil: "2026-08-24T01:00:10.000Z" });
    const second = createCharacterMutation("campaign", "hero-id", 2, { notes: "For the Horde" }, { id: "second", createdAt: "2026-08-24T01:00:01.000Z", debounceKey: "journal:hero-id", deferredUntil: "2026-08-24T01:00:11.000Z" });
    const queued = enqueueSyncEntry(enqueueSyncEntry([], first), second);
    expect(queued).toHaveLength(1);
    expect(queued[0]).toMatchObject({ id: "first", baseRevision: 2, debounceKey: "journal:hero-id", deferredUntil: "2026-08-24T01:00:11.000Z", patch: { notes: "For the Horde" } });
  });

  it("preserves the local portrait while applying a remote snapshot", () => {
    const remote = { ...character, name: "Jaina Proudmoore", portraitDataUrl: undefined, readOnlyReview: false };
    expect(mergeRemoteCharacter(character, remote)).toMatchObject({ name: "Jaina Proudmoore", portraitDataUrl: character.portraitDataUrl, readOnlyReview: false });
  });

  it("removes only the unlinked character's links and queued work", () => {
    const heroMutation = createCharacterMutation("campaign", "hero-id", 1, { currentHp: 4 }, { id: "hero-mutation" });
    const allyMutation = createCharacterMutation("campaign", "ally-id", 1, { currentHp: 8 }, { id: "ally-mutation" });
    const result = removeCharacterSyncState([
      { characterId: "hero-id", campaignId: "campaign", campaignName: "Test", role: "player", revision: 1, linkedAt: "now" },
      { characterId: "ally-id", campaignId: "campaign", campaignName: "Test", role: "dm", revision: 1, linkedAt: "now" },
    ], [heroMutation, allyMutation], "campaign", "hero-id");
    expect(result.links.map((link) => link.characterId)).toEqual(["ally-id"]);
    expect(result.outbox.map((entry) => entry.id)).toEqual(["ally-mutation"]);
  });
});
