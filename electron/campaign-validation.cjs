const ABILITY_METHODS = new Set(["standard-array", "point-buy", "rolled", "manual"]);
const ENCUMBRANCE_RULES = new Set(["variant", "standard", "none"]);
const EQUIPMENT_RULES = new Set(["packages-or-gold", "packages-only", "gold-only"]);

function assertCampaignProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) throw new Error("Campaign profile must be an object.");
  if (profile.schemaVersion !== 1) throw new Error("Campaign profile schema version is invalid.");
  for (const field of ["id", "name", "houseRules", "createdAt", "updatedAt"]) {
    if (typeof profile[field] !== "string" || ((field === "id" || field === "name") && !profile[field].trim())) throw new Error(`Campaign profile ${field} is invalid.`);
  }
  for (const [field, minimum, maximum] of [["startingLevel", 1, 20], ["startingExperience", 0, 99_999_999], ["attunementLimit", 0, 10]]) {
    if (!Number.isInteger(profile[field]) || profile[field] < minimum || profile[field] > maximum) throw new Error(`Campaign profile ${field} is invalid.`);
  }
  if (!Array.isArray(profile.allowedPackIds) || profile.allowedPackIds.some((entry) => typeof entry !== "string" || !entry.trim())) throw new Error("Campaign profile allowedPackIds is invalid.");
  if (!Array.isArray(profile.allowedAbilityMethods) || !profile.allowedAbilityMethods.length || profile.allowedAbilityMethods.some((entry) => !ABILITY_METHODS.has(entry))) throw new Error("Campaign profile allowedAbilityMethods is invalid.");
  if (!ENCUMBRANCE_RULES.has(profile.encumbranceRule)) throw new Error("Campaign profile encumbranceRule is invalid.");
  if (!EQUIPMENT_RULES.has(profile.startingEquipmentRule)) throw new Error("Campaign profile startingEquipmentRule is invalid.");
  if (typeof profile.allowMulticlass !== "boolean" || typeof profile.allowOptionalFeats !== "boolean") throw new Error("Campaign profile advancement settings are invalid.");
  return profile;
}

module.exports = { assertCampaignProfile };
