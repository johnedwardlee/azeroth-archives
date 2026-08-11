import { describe, expect, it } from "vitest";
import { pointBuySpent, startingEquipmentSelection } from "./creation-guide";
import type { EquipmentDefinition } from "../lib/types";

const catalog: EquipmentDefinition[] = [
  { id: "spear", name: "Spear", category: "Simple Melee Weapon", damage: "1d6", damageType: "Piercing" },
  { id: "book", name: "Book", category: "Adventuring Gear" },
  { id: "robe", name: "Robe", category: "Adventuring Gear" },
];

describe("guided creation rules", () => {
  it("calculates the 27-point standard array", () => {
    expect(pointBuySpent({ strength: 15, agility: 14, stamina: 13, intellect: 12, spirit: 10, charisma: 8 })).toBe(27);
  });

  it("turns background option A into inventory and currency", () => {
    const selection = startingEquipmentSelection("Choose A or B: (A) Spear, Book (prayers), 2 Robe, 8 GP; or (B) 50 GP", catalog, "A");
    expect(selection.items.map((item) => [item.definition.name, item.quantity])).toEqual([["Spear", 1], ["Book", 1], ["Robe", 2]]);
    expect(selection.gold).toBe(8);
    expect(selection.unresolved).toEqual([]);
  });

  it("supports the alternate starting-gold choice", () => {
    const selection = startingEquipmentSelection("Choose A or B: (A) Spear, 8 GP; or (B) 50 GP", catalog, "B");
    expect(selection.items).toEqual([]);
    expect(selection.gold).toBe(50);
  });
});
