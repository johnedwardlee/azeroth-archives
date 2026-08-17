import { describe, expect, it } from "vitest";
import { createDmReviewExport, DM_REVIEW_FORMAT, DM_REVIEW_VERSION } from "./dm-review";
import type { CharacterData } from "./types";

describe("DM review export", () => {
  it("creates one versioned JSON document with a safe filename and embedded readiness data", () => {
    const character = { id: "hero-1", name: "Uther / Lightbringer" } as CharacterData;
    const report = { ready: false, errors: [], warnings: [{ id: "warning", severity: "warning" as const, title: "Review", detail: "Check this choice." }], checkedAt: "2026-08-17T12:00:00.000Z" };
    const result = createDmReviewExport(character, report, undefined, "2026-08-17T13:00:00.000Z");

    expect(result.filename).toBe("uther-lightbringer.azeroth-review.json");
    expect(result.document).toMatchObject({ format: DM_REVIEW_FORMAT, version: DM_REVIEW_VERSION, exportedAt: "2026-08-17T13:00:00.000Z", report, character });
    expect(JSON.parse(result.contents)).toEqual(result.document);
  });
});
