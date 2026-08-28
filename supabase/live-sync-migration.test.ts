import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./migrations/202608240001_live_sync.sql", import.meta.url), "utf8");
const invitationFix = readFileSync(new URL("./migrations/202608250001_fix_invitation_redemption.sql", import.meta.url), "utf8");
const rollClear = readFileSync(new URL("./migrations/202608280001_clear_campaign_rolls.sql", import.meta.url), "utf8");

describe("live-sync migration security contract", () => {
  it("keeps direct writes behind authenticated RPC functions", () => {
    expect(migration).toContain("revoke all on public.characters from anon, authenticated");
    expect(migration).toContain("revoke execute on function public.apply_character_mutation");
    expect(migration).toContain("grant execute on function public.apply_character_mutation");
  });

  it("separates DM campaign broadcasts from owner-authorized character broadcasts", () => {
    expect(migration).toContain("public.can_access_dm_campaign_topic");
    expect(migration).toContain("public.can_access_character_topic");
    expect(migration).toContain("'character:' || v_character_id");
    expect(migration).toContain("campaign_private_presence_read");
  });

  it("enforces the approved roll retention limits", () => {
    expect(migration).toContain("interval '30 days'");
    expect(migration).toContain("offset 500");
  });

  it("allows only the campaign DM to clear rolls and broadcasts deletions", () => {
    for (const sql of [migration, rollClear]) {
      expect(sql).toContain("public.clear_campaign_roll_events");
      expect(sql).toContain("public.is_campaign_dm(p_campaign_id, auth.uid())");
      expect(sql).toContain("after insert or delete on public.roll_events");
      expect(sql).toContain("revoke execute on function public.clear_campaign_roll_events(uuid) from public, anon");
    }
  });

  it("resolves invitation membership conflicts by named constraint", () => {
    for (const sql of [migration, invitationFix]) {
      expect(sql).toContain("on conflict on constraint campaign_members_pkey");
      expect(sql).not.toContain("on conflict (campaign_id, user_id)");
    }
  });
});
