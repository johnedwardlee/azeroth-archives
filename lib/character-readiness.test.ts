import { describe, expect, it } from "vitest";
import { newCampaignProfile } from "./campaign-profile";
import { evaluateCharacterReadiness } from "./character-readiness";
import { newCharacter } from "../src/character-manager";
import type { CharacterReadinessContext } from "./character-readiness";

const context: CharacterReadinessContext = {
  ancestries: [{ id: "human", name: "Human", speed: 30, traits: [] }],
  classes: [{ id: "warrior", name: "Warrior", hitDie: 10, primaryAbility: "strength", levelFeatures: {}, savingThrowProficiencies: ["strength", "stamina"] }],
  backgrounds: [{ id: "soldier", name: "Soldier", skills: ["Athletics", "Intimidation"] }],
  feats: [],
  loadedPackIds: ["warcraft"],
};

function readyWarrior() {
  return {
    ...newCharacter(),
    id: "warrior",
    name: "Arthas Test",
    playerName: "Player",
    ancestry: "Human",
    className: "Warrior",
    classLevels: [{ className: "Warrior", level: 1 }],
    background: "Soldier",
    abilityScoresConfirmed: true,
    startingEquipmentConfirmed: true,
    classSkillChoices: ["Athletics", "Perception"],
    skillProficiencies: ["Athletics", "Perception", "Intimidation"],
    weaponMasteries: ["Longsword", "Longbow", "Dagger"],
    inventory: [{ id: "sword", name: "Longsword", quantity: 1, equipped: false, notes: "" }],
  };
}

describe("character readiness", () => {
  it("passes a complete first-level character", () => {
    const report = evaluateCharacterReadiness(readyWarrior(), context);
    expect(report.ready).toBe(true);
    expect(report.errors).toEqual([]);
  });

  it("enforces campaign level, ability method, multiclass, content, and attunement rules", () => {
    const profile = { ...newCampaignProfile(["warcraft", "missing-pack"]), id: "campaign", startingLevel: 3, allowedAbilityMethods: ["point-buy" as const], allowMulticlass: false, attunementLimit: 0 };
    const character = { ...readyWarrior(), campaignProfileId: "campaign", classLevels: [{ className: "Warrior", level: 1 }, { className: "Mage", level: 1 }], level: 2, inventory: [{ id: "sword", name: "Longsword", quantity: 1, equipped: false, attuned: true, notes: "" }] };
    const report = evaluateCharacterReadiness(character, { ...context, campaignProfile: profile });
    expect(report.ready).toBe(false);
    expect(report.errors.map((issue) => issue.id)).toEqual(expect.arrayContaining(["campaign-level", "campaign-ability-method", "campaign-multiclass", "campaign-packs", "campaign-attunement"]));
  });
});
