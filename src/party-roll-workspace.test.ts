import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitiativeRoll } from "./party-roll-workspace";

describe("player Party Rolls initiative", () => {
  afterEach(() => vi.restoreAllMocks());

  it("uses the character modifier and the selected advantage mode", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.1).mockReturnValueOnce(0.9);
    const roll = createInitiativeRoll({ modifier: 3, forcedDisadvantage: false, detail: "" }, "advantage");

    expect(roll.event).toMatchObject({ category: "initiative", label: "Initiative", dice: [3, 19], modifier: 3, total: 22, mode: "advantage" });
    expect(roll.result).toBe("Initiative: 3 / 19 +3 = 22 · advantage");
  });

  it("cancels selected advantage when the character has forced disadvantage", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0.45);
    const roll = createInitiativeRoll({ modifier: -1, forcedDisadvantage: true, detail: "Poisoned" }, "advantage");

    expect(roll.event).toMatchObject({ dice: [10], modifier: -1, total: 9, mode: "normal", detail: "Poisoned" });
    expect(roll.result).toBe("Initiative: 10 −1 = 9");
  });
});
