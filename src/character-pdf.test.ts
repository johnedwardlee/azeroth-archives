import { describe, expect, it } from "vitest";
import { buildCharacterPdf, type CharacterPdfSection } from "./character-pdf";

describe("buildCharacterPdf", () => {
  it("builds a themed overview and detailed living record", async () => {
    const overviewSections: CharacterPdfSection[] = [
      { title: "SAVING THROWS", icon: "shield", rows: [{ name: "Strength", detail: "+5" }] },
      { title: "SKILLS", icon: "book", rows: [{ name: "Athletics", detail: "Strength +5" }] },
      { title: "ATTACKS", icon: "blades", rows: [{ name: "Warhammer", detail: "Attack +5 - 1d8 +3" }] },
      { title: "FEATURES", icon: "scroll", rows: [{ name: "Protector", detail: "Guard nearby allies." }] },
      { title: "SPELLS", icon: "spark", rows: [{ name: "Holy Light", detail: "Level 1 evocation" }] },
      { title: "EQUIPMENT", icon: "satchel", rows: [{ name: "1x Warhammer", detail: "Weapon" }] },
      { title: "NOTES", icon: "quill", rows: [{ name: "Campaign notes", detail: "Journey east." }] },
    ];
    const bytes = await buildCharacterPdf({
      name: "Test Hero",
      playerName: "Player",
      identityLine: "Human - Level 1: Paladin 1 - Soldier",
      stats: [
        { label: "ARMOR", value: "16", icon: "shield" },
        { label: "HIT POINTS", value: "12 / 12", icon: "heart" },
        { label: "SPEED", value: "30 FT", icon: "boot" },
        { label: "PROFICIENCY", value: "+2", icon: "star" },
      ],
      abilities: [
        { label: "Strength", score: 16, modifier: "+3" },
        { label: "Agility", score: 12, modifier: "+1" },
        { label: "Stamina", score: 14, modifier: "+2" },
        { label: "Intellect", score: 10, modifier: "+0" },
        { label: "Spirit", score: 13, modifier: "+1" },
        { label: "Charisma", score: 15, modifier: "+2" },
      ],
      overviewSections,
      detailMeta: "Hit Dice 1/1 - Inspiration No - GP 10 SP 0 CP 0",
      detailSections: overviewSections,
    });

    const source = new TextDecoder("latin1").decode(bytes);
    expect(source.startsWith("%PDF-")).toBe(true);
    expect(bytes.byteLength).toBeGreaterThan(8_000);
    expect(source.match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
