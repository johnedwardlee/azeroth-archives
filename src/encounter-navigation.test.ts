import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("v1.5 navigation and encounter workspace", () => {
  it("uses the six consolidated primary destinations", () => {
    const source = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
    expect(source).toContain('type Tab = "encounter" | "character" | "spellbook" | "inventory" | "companions" | "journal"');
    expect(source).toContain('["encounter", "character", "spellbook", "inventory", "companions", "journal"]');
    expect(source).toContain('character.finalizedAt || character.readOnlyReview ? "encounter" : "character"');
  });

  it("keeps detailed character and combat management together", () => {
    const source = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
    expect(source.match(/tab === "character"/g)?.length).toBeGreaterThanOrEqual(3);
    expect(source).toContain('<CombatManager catalog={equipment} character={character} patchCharacter={patchCharacter} />');
  });

  it("provides action-economy and purpose filters without removing unavailable cards", () => {
    const source = readFileSync(new URL("./action-dashboard.tsx", import.meta.url), "utf8");
    expect(source).toContain('Action economy filters');
    expect(source).toContain('Action purpose filters');
    expect(source).toContain('unavailableReason(action)');
    expect(source).toContain('unavailable choices remain visible');
  });
});
