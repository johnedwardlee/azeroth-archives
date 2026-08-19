import { describe, expect, it } from "vitest";
import { newCampaignProfile, normalizeCampaignProfile, parseCampaignProfileFile, serializeCampaignProfile } from "./campaign-profile";

describe("campaign profiles", () => {
  it("normalizes unsafe values and round-trips the portable file format", () => {
    const profile = normalizeCampaignProfile({
      id: "test-campaign",
      name: " Test Campaign ",
      startingLevel: 99,
      startingExperience: -20,
      allowedPackIds: ["warcraft", "warcraft", ""],
      allowedAbilityMethods: ["point-buy"],
      encumbranceRule: "none",
      startingEquipmentRule: "packages-only",
      allowMulticlass: false,
      allowOptionalFeats: false,
      attunementLimit: 2,
    });

    expect(profile).toMatchObject({ name: "Test Campaign", startingLevel: 20, startingExperience: 0, allowedPackIds: ["warcraft"], allowedAbilityMethods: ["point-buy"], attunementLimit: 2 });
    expect(parseCampaignProfileFile(JSON.parse(serializeCampaignProfile(profile)))).toEqual(profile);
  });

  it("rejects unrelated JSON files", () => {
    expect(() => parseCampaignProfileFile({ format: "something-else" })).toThrow(/not an Azeroth Archives campaign profile/i);
  });

  it("uses standard 5e encumbrance and migrates legacy variant profiles", () => {
    expect(newCampaignProfile().encumbranceRule).toBe("standard");
    expect(normalizeCampaignProfile({ encumbranceRule: "variant" }).encumbranceRule).toBe("standard");
    expect(normalizeCampaignProfile({ encumbranceRule: "none" }).encumbranceRule).toBe("none");
  });
});
