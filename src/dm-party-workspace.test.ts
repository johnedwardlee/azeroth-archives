import { describe, expect, it } from "vitest";
import type { EquipmentDefinition, InventoryItem } from "../lib/types";
import { createDmCatalogItem, createDmCustomItem, patchDmInventoryItem } from "./dm-party-workspace";

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
