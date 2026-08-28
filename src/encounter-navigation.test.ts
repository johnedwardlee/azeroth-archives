import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("v1.5 navigation and encounter workspace", () => {
  it("uses the consolidated player destinations plus the DM Party workspace", () => {
    const source = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
    expect(source).toContain('type Tab = "party" | "encounter" | "character" | "spellbook" | "inventory" | "companions" | "journal"');
    expect(source).toContain('appRole === "dm" ? ["party" as const] : []');
    expect(source).toContain('"encounter", "character", "spellbook", "inventory", "companions", "journal"');
    expect(source).toContain('character.finalizedAt || character.readOnlyReview ? "encounter" : "character"');
  });

  it("keeps detailed character and combat management together", () => {
    const source = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
    expect(source.match(/tab === "character"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('<CombatManager catalog={equipment} character={character} patchCharacter={patchCharacter} onRoll={publishCharacterRoll} />');
  });

  it("provides action-economy and purpose filters without removing unavailable cards", () => {
    const source = readFileSync(new URL("./action-dashboard.tsx", import.meta.url), "utf8");
    expect(source).toContain('Action economy filters');
    expect(source).toContain('Action purpose filters');
    expect(source).toContain('unavailableReason(action)');
    expect(source).toContain('unavailable choices remain visible');
    expect(source).toContain('encounter-library-v2');
    expect(source).toContain('className="encounter-library-inline"');
    expect(source).toContain("favoriteActionsFirst(actions.filter");
    expect(source).not.toContain('title="Quick bar"');
    expect(source).not.toContain("encounter-quick-bar");
    expect(source).not.toContain('<section className="panel encounter-library"');
  });

  it("moves During Play into Encounter and resolves attack and damage rolls inline", () => {
    const encounter = readFileSync(new URL("./action-dashboard.tsx", import.meta.url), "utf8");
    const character = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
    expect(encounter).toContain("<SessionTracker");
    expect(character).not.toContain("<SessionTracker");
    expect(encounter).toContain('aria-label="Encounter D20 roll mode"');
    expect(encounter).toContain("function rollInitiative()");
    expect(encounter).toContain('category: "initiative"');
    expect(encounter).toContain("resolveD20(action");
    expect(encounter).toContain("rollResolvedDamage(true)");
    expect(encounter).toContain('mode === "advantage" ? "2d20 high"');
    expect(encounter).toContain('return `${ABILITY_LABELS[saveAbility]} DC ${8 + character.proficiencyBonus');
    expect(encounter).toContain('return "Use · no roll"');
    expect(encounter).not.toContain('action.spellId ? "Cast"');
    expect(encounter).toContain("spellDamageProfile(spell");
    expect(encounter).toContain("spellHealingProfile(spell");
    expect(encounter).toContain("extractDiceFormula(action.description)");
    expect(encounter).toContain("if (damage?.automatic) rollResolvedDamage(false, damage)");
    expect(encounter).toContain("pendingDamage.allowCritical");
    expect(encounter).toContain('encumbranceRule = "standard"');
  });
});
