import { describe, expect, it } from "vitest";
import { recordRecentAction, toggleFavoriteAction } from "./action-history";
import type { GeneratedAction } from "./character-rules";

const action: GeneratedAction = { id: "spell-fire", name: "Fire Bolt", timing: "action", source: "Spell · Cantrip", description: "A bolt of flame." };

describe("action history", () => {
  it("toggles a favorite without disturbing its order", () => {
    expect(toggleFavoriteAction(["attack-sword"], action.id)).toEqual(["attack-sword", action.id]);
    expect(toggleFavoriteAction(["attack-sword", action.id], action.id)).toEqual(["attack-sword"]);
  });

  it("moves a repeated action to the front and keeps its latest result", () => {
    const recentActions = recordRecentAction({ recentActions: [{ actionId: action.id, name: action.name, source: action.source, timing: action.timing, result: "Old", usedAt: "2026-01-01T00:00:00.000Z" }] }, action, "Cast as a cantrip", "2026-08-17T00:00:00.000Z");
    expect(recentActions).toHaveLength(1);
    expect(recentActions[0]).toMatchObject({ actionId: action.id, result: "Cast as a cantrip", usedAt: "2026-08-17T00:00:00.000Z" });
  });
});
