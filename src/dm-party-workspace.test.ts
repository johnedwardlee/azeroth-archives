import { describe, expect, it } from "vitest";
import type { EquipmentDefinition, InventoryItem } from "../lib/types";
import { newCharacter } from "./character-manager";
import { addDmConditionPatch, concentratingOn, createDmCatalogItem, createDmCustomItem, patchDmInventoryItem, removeDmConditionPatch } from "./dm-party-workspace";

const catalogItem: EquipmentDefinition = {
  id: "longbow",
  name: "Longbow",
  category: "Martial Ranged",
  description: "A ranged weapon.",
  cost: "50 GP",
  weight: "2 lb.",
};

describe("DM party inventory controls", () => {
  it("creates catalog and custom items with stable inventory defaults", () => {
    expect(createDmCatalogItem(catalogItem, "catalog-id")).toMatchObject({ id: "catalog-id", contentId: "longbow", name: "Longbow", quantity: 1, equipped: false, notes: "" });
    expect(createDmCustomItem("  Hearthstone  ", "custom-id")).toEqual({ id: "custom-id", name: "Hearthstone", category: "Custom", quantity: 1, equipped: false, notes: "", equipmentSlot: "none" });
  });

  it("updates quantity and ammunition without disturbing other inventory items", () => {
    const inventory: InventoryItem[] = [
      { id: "bow", name: "Longbow", quantity: 1, ammunition: 20, equipped: false, notes: "" },
      { id: "rope", name: "Rope", quantity: 1, equipped: false, notes: "" },
    ];
    const updated = patchDmInventoryItem(inventory, "bow", { quantity: 2, ammunition: 18 });
    expect(updated[0]).toMatchObject({ quantity: 2, ammunition: 18 });
    expect(updated[1]).toBe(inventory[1]);
  });

  it("clamps negative quantity and ammunition values", () => {
    const inventory: InventoryItem[] = [{ id: "arrows", name: "Arrows", quantity: 1, ammunition: 1, equipped: false, notes: "" }];
    expect(patchDmInventoryItem(inventory, "arrows", { quantity: -4, ammunition: -10 })[0]).toMatchObject({ quantity: 0, ammunition: 0 });
  });
});

describe("DM party condition controls", () => {
  it("adds standard conditions, respects immunity, and tracks exhaustion", () => {
    const character = { ...newCharacter(), conditionImmunities: ["Poisoned"] };
    expect(addDmConditionPatch(character, "Prone")).toMatchObject({ conditions: ["Prone"] });
    expect(addDmConditionPatch(character, "Exhaustion")).toMatchObject({ conditions: ["Exhaustion"], exhaustionLevel: 1 });
    expect(addDmConditionPatch(character, "Poisoned")).toEqual({});
  });

  it("ends concentration when an incapacitating condition is applied", () => {
    const character = { ...newCharacter(), concentratingSpellId: "renew", activeEffects: [{ id: "renew-effect", name: "Renew", source: "Spell", duration: "manual" as const, concentration: true }] };
    expect(concentratingOn(character)).toBe("Renew");
    expect(addDmConditionPatch(character, "Stunned")).toMatchObject({ conditions: ["Stunned"], concentratingSpellId: undefined, activeEffects: [] });
  });

  it("removes manual conditions and clears exhaustion level", () => {
    const character = { ...newCharacter(), conditions: ["Prone", "Exhaustion"], exhaustionLevel: 2 };
    expect(removeDmConditionPatch(character, "Prone")).toMatchObject({ conditions: ["Exhaustion"] });
    expect(removeDmConditionPatch(character, "Exhaustion")).toMatchObject({ conditions: ["Prone"], exhaustionLevel: 0 });
  });
});
