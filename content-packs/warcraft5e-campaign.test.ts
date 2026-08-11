import { describe, expect, it } from "vitest";
import packJson from "./warcraft5e-campaign.w5e?raw";
import type { ContentPack } from "../lib/types";

const pack = JSON.parse(packJson) as ContentPack;

describe("bundled Warcraft content pack", () => {
  it("has the expected baseline coverage", () => {
    expect(pack.schemaVersion).toBe("2.0");
    expect(pack.ancestries).toHaveLength(4);
    expect(pack.classes).toHaveLength(10);
    expect(pack.backgrounds?.length).toBeGreaterThanOrEqual(17);
    expect(pack.feats?.length).toBeGreaterThanOrEqual(75);
    expect(pack.equipment?.length).toBeGreaterThanOrEqual(218);
    expect(pack.spells?.length).toBeGreaterThanOrEqual(385);
  });

  it("contains no duplicate ids or placeholder descriptions", () => {
    const features = [
      ...(pack.ancestries ?? []).flatMap((item) => item.traits),
      ...(pack.classes ?? []).flatMap((item) => [...Object.values(item.levelFeatures).flat(), ...(item.subclasses ?? []).flatMap((subclass) => Object.values(subclass.levelFeatures).flat())]),
      ...(pack.backgrounds ?? []).flatMap((item) => item.feature ? [item.feature] : []),
    ];
    const collections = [
      pack.ancestries ?? [],
      pack.classes ?? [],
      (pack.classes ?? []).flatMap((item) => item.subclasses ?? []),
      features,
      pack.backgrounds ?? [],
      pack.feats ?? [],
      pack.equipment ?? [],
      pack.spells ?? [],
    ];
    for (const collection of collections) {
      const ids = collection.map((item) => item.id).filter(Boolean);
      expect(new Set(ids).size).toBe(ids.length);
    }
    const records = collections.flat();
    const descriptions = records.map((item) => "description" in item && typeof item.description === "string" ? item.description : "").filter(Boolean);
    expect(descriptions.some((text) => /consult the linked source|reference entry|placeholder/i.test(text))).toBe(false);
  });
});
