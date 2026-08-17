import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("character setup placement", () => {
  it("keeps unfinished setup at the top and moves the finalized control below the active view", () => {
    const source = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
    const readiness = source.indexOf("creationSetupVisible && <ReadinessPanel");
    const firstView = source.indexOf('tab === "character"');
    const lastView = source.indexOf('tab === "journal"');
    const completedControl = source.indexOf("completed-setup-toggle completed-setup-toggle-bottom");

    expect(source).toContain("!character.finalizedAt || showCompletedSetup");
    expect(readiness).toBeGreaterThan(firstView);
    expect(completedControl).toBeGreaterThan(lastView);
  });
});
