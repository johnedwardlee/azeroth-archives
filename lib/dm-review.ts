import type { CharacterReadinessReport } from "./character-readiness";
import type { CampaignProfile, CharacterData } from "./types";

export const DM_REVIEW_FORMAT = "azeroth-archives-dm-review";
export const DM_REVIEW_VERSION = 1;

export function createDmReviewExport(character: CharacterData, report: CharacterReadinessReport, campaignProfile?: CampaignProfile, exportedAt = new Date().toISOString()) {
  const safeName = character.name.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "character";
  const document = {
    format: DM_REVIEW_FORMAT,
    version: DM_REVIEW_VERSION,
    exportedAt,
    campaignProfile,
    report,
    character,
  };
  return {
    filename: `${safeName}.azeroth-review.json`,
    contents: JSON.stringify(document, null, 2),
    document,
  };
}
