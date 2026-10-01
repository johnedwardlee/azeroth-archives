import { describe, expect, it } from "vitest";
import { createElement, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { campaignOptionLabel, formatInvitationCodeInput, LiveSyncPanel, playerConnectionForm } from "./live-sync-panel";
import type { CharacterData, CharacterSyncLink, LiveCampaign } from "../lib/types";

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
  const dmCampaign = { id: "campaign", name: "Azeroth", role: "dm" } as LiveCampaign;
  const completeCode = "A2E44D-5C0FFE-E1BAD2-22CAFE";
  function recoveryForm(overrides: Partial<Parameters<typeof playerConnectionForm>[0]> = {}) {
    return playerConnectionForm({ characters: [character], links: [link], recover: true, characterId: "hero", inviteCode: completeCode, busy: false, ...overrides });
  }

  it("enables signed-out recovery with a complete code and no saved player name", () => {
    const namelessPlayer = { ...character, playerName: "" };
    const result = recoveryForm({ characters: [namelessPlayer] });
    expect(result).toMatchObject({ characterId: "hero", playerName: "Jaina", requirements: [] });
    expect(namelessPlayer.playerName).toBe("");
  });

  it("uses the selected sheet's saved player name rather than another sheet's name", () => {
    const other = { ...character, id: "other", playerName: "Other player" };
    const result = recoveryForm({ characters: [other, character], links: [{ ...link, characterId: "other" }, link] });
    expect(result.playerName).toBe("Player");
    expect(result.characterId).toBe("hero");
    expect(result.requirements).toEqual([]);
  });

  it("selects the existing linked character if data arrives after the panel opens", () => {
    expect(recoveryForm({ characterId: "" })).toMatchObject({ characterId: "hero", requirements: [] });
    expect(recoveryForm({ characterId: "deleted" })).toMatchObject({ characterId: "hero", requirements: [] });
  });

  it("keeps a manually entered name and explains an explicitly blank name", () => {
    expect(recoveryForm({ playerName: "Chosen label" }).playerName).toBe("Chosen label");
    expect(recoveryForm({ playerName: " " }).requirements).toEqual(["Enter a player name."]);
    expect(recoveryForm({ playerName: "a".repeat(121) }).requirements).toEqual(["Player name must be 120 characters or fewer."]);
  });

  it("explains incomplete codes, missing character links, and pending operations", () => {
    expect(recoveryForm({ inviteCode: "A2E44D" }).requirements).toEqual(["Enter the complete 24-character recovery code from the DM."]);
    expect(recoveryForm({ links: [] }).requirements.join(" ")).toContain("No previously linked character is available");
    expect(recoveryForm({ characters: [] }).characterId).toBe("");
    expect(recoveryForm({ busy: true }).requirements).toEqual(["A connection operation is in progress. Please wait."]);
  });

  it("does not silently use the character name for a new player's initial invitation", () => {
    const result = recoveryForm({ recover: false, links: [], characters: [{ ...character, playerName: "" }] });
    expect(result.characterId).toBe("hero");
    expect(result.playerName).toBe("");
    expect(result.requirements).toEqual(["Enter a player name."]);
  });
  it("distinguishes same-name campaigns by their IDs without relabeling unique names", () => {
    const original = { ...dmCampaign, id: "fa03dcda-fa2c-4434-a194-296e11802259" };
    const empty = { ...dmCampaign, id: "3ee990a8-f9c8-422b-b616-195be03166b9" };
    expect(campaignOptionLabel(original, [original, empty])).toBe("Azeroth · fa03dcda");
    expect(campaignOptionLabel(empty, [original, empty])).toBe("Azeroth · 3ee990a8");
    expect(campaignOptionLabel(original, [original])).toBe("Azeroth");
  });
  function render(overrides: Partial<ComponentProps<typeof LiveSyncPanel>> = {}) {
    return renderToStaticMarkup(createElement(LiveSyncPanel, {
      status: { configured: true, authenticated: false, anonymous: false, connection: "signed-out", message: "Signed out" },
      appRole: "player", characters: [character], links: [link], campaigns: [],
      onClose: () => undefined, onReconnect: async () => undefined, onRequestDmLink: async () => undefined, onCreateCampaign: async () => undefined,
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
    expect(html).toContain("Reconnect to your campaign");
    expect(html).toContain("Enter DM recovery code");
  });

  it("shows real prefilled values and an explanation instead of an unexplained disabled recovery button", () => {
    const html = render({ characters: [{ ...character, playerName: "" }] });
    expect(html).toContain('placeholder="Your name" value="Jaina"');
    expect(html).toContain('aria-describedby="player-link-requirements"');
    expect(html).toContain("Enter the complete 24-character recovery code from the DM.");
    expect(html).not.toContain("Enter a player name.");
    expect(html).toContain("Your character sheet is not renamed.");
  });

  it.each(["offline", "error", "connecting"] as const)("exposes reconnect and existing-character recovery while %s with a saved identity", (connection) => {
    const html = render({ status: { configured: true, authenticated: true, anonymous: true, connection, message: "Connection unavailable" } });
    expect(html).toContain(">Reconnect</button>");
    expect(html).toContain("Enter DM recovery code");
    expect(html).toContain("Previously linked character");
    expect(html).toContain('<option value="hero" selected="">Jaina');
    expect(html).toContain("Your local sheet, character links, and queued changes are kept.");
  });

  it("keeps reconnect and recovery access available even when the player is live", () => {
    const html = render({ status: { configured: true, authenticated: true, anonymous: true, connection: "live", message: "Live" } });
    expect(html).toContain(">Reconnect</button>");
    expect(html).toContain("Enter DM recovery code");
    expect(html).toContain("Open recovery form");
  });

  it("keeps new-player invitation linking available without showing recovery by default", () => {
    const html = render({ links: [] });
    expect(html).toContain("Join the DM");
    expect(html).toContain("Link character");
    expect(html).not.toContain("Previously linked character");
  });

  it("lets an authenticated DM issue character-specific recovery codes in the active campaign", () => {
    const html = render({ appRole: "dm", activeCampaignId: "campaign", campaigns: [dmCampaign], links: [{ ...link, role: "dm" }], status: { configured: true, authenticated: true, anonymous: false, connection: "live", message: "Live" } });
    expect(html).toContain("Generate recovery code");
  });

  it("shows DM code generation, not player recovery, for the screenshot's stale player-role links", () => {
    const html = render({ appRole: "dm", activeCampaignId: "campaign", campaigns: [dmCampaign], links: [link], status: { configured: true, authenticated: true, anonymous: false, connection: "live", message: "Live" } });
    expect(html).toContain("Generate recovery code");
    expect(html).toContain("DM view");
    expect(html).not.toContain("Recover connection");
    expect(html).not.toContain("Open recovery form");
    expect(html).not.toContain(">Unlink<");
    expect(html).toContain("The player enters it on their own installation.");
  });

  it("does not trust DM app mode when the signed-in account only has player membership", () => {
    const html = render({ appRole: "dm", activeCampaignId: "campaign", campaigns: [{ ...dmCampaign, role: "player" }], status: { configured: true, authenticated: true, anonymous: false, connection: "live", message: "Live" } });
    expect(html).not.toContain("Generate recovery code");
    expect(html).not.toContain("Open recovery form");
  });

  it("explains an anonymous player identity on a DM-mode installation", () => {
    const html = render({ appRole: "dm", activeCampaignId: "campaign", campaigns: [dmCampaign], status: { configured: true, authenticated: true, anonymous: true, connection: "live", message: "Live" } });
    expect(html).toContain("This device is signed in as a player.");
    expect(html).not.toContain("Generate recovery code");
    expect(html).not.toContain("Open recovery form");
  });

  it("does not offer recovery codes for other campaigns or while the DM is signed out", () => {
    const links: CharacterSyncLink[] = [{ ...link, role: "dm" }];
    expect(render({ appRole: "dm", links, campaigns: [dmCampaign], activeCampaignId: "campaign" })).not.toContain("Generate recovery code");
    expect(render({ appRole: "dm", links, campaigns: [dmCampaign], activeCampaignId: "other", status: { configured: true, authenticated: true, anonymous: false, connection: "live", message: "Live" } })).not.toContain("Generate recovery code");
  });
});
