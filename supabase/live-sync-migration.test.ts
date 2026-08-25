import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(new URL("./migrations/202608240001_live_sync.sql", import.meta.url), "utf8");

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
});
