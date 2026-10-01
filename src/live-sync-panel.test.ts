import { describe, expect, it } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { formatInvitationCodeInput, LiveSyncPanel } from "./live-sync-panel";
import type { CharacterData, CharacterSyncLink } from "../lib/types";

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

describe("connection recovery controls", () => {
  const character = { id: "hero", name: "Jaina", playerName: "Player", level: 2, className: "Mage" } as CharacterData;
  const link = { characterId: "hero", campaignId: "campaign", campaignName: "Azeroth", role: "player", revision: 3 } as CharacterSyncLink;
  function render(overrides: Partial<ComponentProps<typeof LiveSyncPanel>> = {}) {
    return renderToStaticMarkup(createElement(LiveSyncPanel, {
      status: { configured: true, authenticated: false, anonymous: false, connection: "signed-out", message: "Signed out" },
      appRole: "player", characters: [character], links: [link], campaigns: [],
      onClose: () => undefined, onRequestDmLink: async () => undefined, onCreateCampaign: async () => undefined,
      onSelectCampaign: async () => undefined, onCreateInvitation: async () => undefined, onRedeemInvitation: async () => undefined,
      onUnlinkCharacter: async () => undefined, onSignOut: async () => undefined, ...overrides,
    }));
  }

  it("offers recovery while signed out and allows the already-linked character to be selected", () => {
    const html = render();
    expect(html).toContain("Recover connection");
    expect(html).toContain("Previously linked character");
    expect(html).toContain('<option value="hero" selected="">Jaina');
    expect(html).toContain("without uploading a replacement");
    expect(html).not.toContain("Sign in by email");
  });

  it("keeps new-player invitation linking available without showing recovery by default", () => {
    const html = render({ links: [] });
    expect(html).toContain("Join the DM");
    expect(html).toContain("Link character");
    expect(html).not.toContain("Previously linked character");
  });

  it("lets an authenticated DM issue character-specific recovery codes in the active campaign", () => {
    const html = render({ appRole: "dm", activeCampaignId: "campaign", links: [{ ...link, role: "dm" }], status: { configured: true, authenticated: true, anonymous: false, connection: "live", message: "Live" } });
    expect(html).toContain("Generate recovery code");
  });

  it("does not offer recovery codes for other campaigns or while the DM is signed out", () => {
    const links: CharacterSyncLink[] = [{ ...link, role: "dm" }];
    expect(render({ appRole: "dm", links, activeCampaignId: "campaign" })).not.toContain("Generate recovery code");
    expect(render({ appRole: "dm", links, activeCampaignId: "other", status: { configured: true, authenticated: true, anonymous: false, connection: "live", message: "Live" } })).not.toContain("Generate recovery code");
  });
});
