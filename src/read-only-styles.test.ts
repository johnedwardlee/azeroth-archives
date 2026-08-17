import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("DM review interaction styles", () => {
  it("keeps collapsible panel headers interactive while editing controls are locked", () => {
    const css = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
    expect(css).toContain(".review-readonly .panel button:not(.inventory-expand)");
    expect(css).toContain(".review-readonly .panel button.collapsible-heading { pointer-events: auto; }");
  });
});
