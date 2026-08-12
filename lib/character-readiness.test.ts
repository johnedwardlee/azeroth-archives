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
  spells: [],
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

  it("requires a complete same-list Magic Initiate setup", () => {
    const magicInitiate = { id: "magic-initiate", name: "Magic Initiate", category: "Origin", description: "You learn two cantrips from the Priest, Nature, or Mage spell list." };
    const spells = [
      { id: "light", name: "Light", level: 0, school: "Evocation", classes: ["Priest"], castingTime: "Action", range: "Touch", components: "V", duration: "1 hour", description: "Light." },
      { id: "guidance", name: "Guidance", level: 0, school: "Divination", classes: ["Priest"], castingTime: "Action", range: "Touch", components: "V", duration: "1 minute", description: "Guidance." },
      { id: "bless", name: "Bless", level: 1, school: "Enchantment", classes: ["Priest"], castingTime: "Action", range: "30 feet", components: "V", duration: "1 minute", description: "Bless." },
    ];
    const incomplete = { ...readyWarrior(), feats: [magicInitiate] };
    expect(evaluateCharacterReadiness(incomplete, { ...context, feats: [magicInitiate], spells }).errors.map((issue) => issue.id)).toContain("feat-magic-initiate");
    const complete = {
      ...incomplete,
      featSpellcastingChoices: [{ featId: magicInitiate.id, spellList: "Priest", ability: "spirit" as const, cantripIds: ["light", "guidance"], levelOneSpellId: "bless", freeCastUsed: false }],
      spells: spells.map((spell) => ({ ...spell, prepared: true, sourceFeatId: magicInitiate.id, castingAbility: "spirit" as const })),
    };
    expect(evaluateCharacterReadiness(complete, { ...context, feats: [magicInitiate], spells }).errors.map((issue) => issue.id)).not.toContain("feat-magic-initiate");
  });

  it("blocks finalization until starting class spell counts are complete", () => {
    const spells = [
      { id: "command", name: "Command", level: 1, school: "Enchantment", classes: ["Paladin"], castingTime: "Action", range: "60 feet", components: "V", duration: "1 round", description: "Command." },
      { id: "duel", name: "Compelled Duel", level: 1, school: "Enchantment", classes: ["Paladin"], castingTime: "Bonus Action", range: "30 feet", components: "V", duration: "1 minute", description: "Duel." },
    ];
    const paladinContext = { ...context, classes: [{ id: "paladin", name: "Paladin", hitDie: 10, primaryAbility: "charisma" as const, levelFeatures: {} }], spells };
    const paladin = { ...readyWarrior(), className: "Paladin", classLevels: [{ className: "Paladin", level: 1 }], spells: [] };
    const missingIds = evaluateCharacterReadiness(paladin, paladinContext).errors.map((issue) => issue.id);
    expect(missingIds).toEqual(expect.arrayContaining(["spells-learned-Paladin", "spells-prepared-low-Paladin"]));
    const complete = { ...paladin, spells: spells.map((spell) => ({ ...spell, prepared: true, className: "Paladin" })) };
    const completeIds = evaluateCharacterReadiness(complete, paladinContext).errors.map((issue) => issue.id);
    expect(completeIds).not.toEqual(expect.arrayContaining(["spells-learned-Paladin", "spells-prepared-low-Paladin"]));
  });
});
