import { describe, expect, it } from "vitest";
import { formatInvitationCodeInput } from "./live-sync-panel";

describe("formatInvitationCodeInput", () => {
  it("accepts typed lowercase invitation characters and inserts separators", () => {
    expect(formatInvitationCodeInput("a2e44d5c0ffee1bad222cafe")).toBe("A2E44D-5C0FFE-E1BAD2-22CAFE");
  });

  it("normalizes a copied invitation and ignores surrounding whitespace", () => {
    expect(formatInvitationCodeInput("  a2e44d-5c0ffe-e1bad2-22cafe  ")).toBe("A2E44D-5C0FFE-E1BAD2-22CAFE");
  });

  it("limits the field to one complete invitation code", () => {
    expect(formatInvitationCodeInput("A2E44D5C0FFEE1BAD222CAFE123456")).toBe("A2E44D-5C0FFE-E1BAD2-22CAFE");
  });
});
