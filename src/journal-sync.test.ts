import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("journal live-sync debounce contract", () => {
  const manager = readFileSync(new URL("./character-manager.tsx", import.meta.url), "utf8");
  const journal = readFileSync(new URL("./journal-manager.tsx", import.meta.url), "utf8");

  it("defers journal typing for ten idle seconds and flushes on blur", () => {
    expect(manager).toContain("delayMs: 10_000");
    expect(manager).toContain("deferredUntil");
    expect(manager).toContain("scheduleDeferredSyncFlush");
    expect(journal).toContain("onBlur=");
    expect(journal).toContain("flushLiveSync: true");
  });

  it("keeps discrete journal actions immediate", () => {
    expect(journal).toContain("update(entry.id, { pinned: !entry.pinned }, true)");
    expect(journal).toContain("status: event.target.value as JournalEntryStatus }, true");
  });
});
