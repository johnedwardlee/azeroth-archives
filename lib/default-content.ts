import type { ContentPack } from "./types";

export const coreContent: ContentPack = {
  schemaVersion: "1.0",
  pack: {
    id: "warcraft5e-core-preview",
    name: "Warcraft 5E Core Preview",
    version: "0.1.0",
    description: "A small starter pack for testing the character manager.",
  },
  ancestries: [
    {
      id: "human",
      name: "Human",
      speed: 30,
      abilityBonuses: { charisma: 1, spirit: 1 },
      traits: [
        { name: "Human Spirit", description: "Your determination carries you through the most difficult trials." },
        { name: "Versatile Training", description: "Choose one additional trained skill during character creation." },
      ],
    },
    {
      id: "orc",
      name: "Orc",
      speed: 30,
      abilityBonuses: { strength: 2, stamina: 1 },
      traits: [
        { name: "Battle Hardened", description: "You have learned to keep fighting when others would fall." },
        { name: "Powerful Build", description: "You count as one size larger when determining carrying capacity." },
      ],
    },
    {
      id: "night-elf",
      name: "Night Elf",
      speed: 35,
      abilityBonuses: { agility: 2, spirit: 1 },
      traits: [
        { name: "Shadowmeld", description: "You can fade into natural darkness while remaining still." },
        { name: "Keen Senses", description: "Your ancient senses grant training in Perception." },
      ],
    },
  ],
  classes: [
    {
      id: "warrior",
      name: "Warrior",
      hitDie: 10,
      primaryAbility: "strength",
      levelFeatures: {
        "1": [{ name: "Battle Stance", description: "Adopt a practiced stance that shapes your approach to combat." }],
        "2": [{ name: "Second Wind", description: "Draw on your reserves to recover in the heat of battle." }],
        "3": [{ name: "Martial Path", description: "Commit to the discipline that defines your battlefield role." }],
        "4": [{ name: "Ability Improvement", description: "Improve your capabilities or select an appropriate feat." }],
      },
    },
    {
      id: "mage",
      name: "Mage",
      hitDie: 6,
      primaryAbility: "intellect",
      levelFeatures: {
        "1": [{ name: "Spellcasting", description: "Shape arcane power through your spellbook and prepared spells." }],
        "2": [{ name: "Arcane Recovery", description: "Recover a measure of magical power during a short rest." }],
        "3": [{ name: "Arcane Tradition", description: "Choose the magical discipline that guides your studies." }],
        "4": [{ name: "Ability Improvement", description: "Improve your capabilities or select an appropriate feat." }],
      },
    },
    {
      id: "hunter",
      name: "Hunter",
      hitDie: 10,
      primaryAbility: "agility",
      levelFeatures: {
        "1": [{ name: "Hunter's Mark", description: "Focus your senses and attacks upon a chosen quarry." }],
        "2": [{ name: "Fieldcraft", description: "Your travels teach you practical techniques for surviving the wilds." }],
        "3": [{ name: "Hunter Path", description: "Choose a path that defines your bond with beast, bow, or blade." }],
        "4": [{ name: "Ability Improvement", description: "Improve your capabilities or select an appropriate feat." }],
      },
    },
  ],
  backgrounds: [
    { id: "soldier", name: "Soldier", skills: ["Athletics", "Intimidation"] },
    { id: "scholar", name: "Scholar", skills: ["Arcana", "History"] },
    { id: "wanderer", name: "Wanderer", skills: ["Nature", "Survival"] },
  ],
};
