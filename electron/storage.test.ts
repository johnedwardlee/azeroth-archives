import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createStorage, STORE_VERSION } = require("./storage.cjs") as {
  STORE_VERSION: number;
  createStorage: (options: {
    getUserDataPath: () => string;
    validatePack: (pack: unknown) => void;
    backupIntervalMs?: number;
  }) => {
    dataPath: () => string;
    backupPath: () => string;
    load: () => Promise<{ version: number; characters: Array<{ id: string; name: string }>; packs: unknown[]; recovery?: { restoredFrom?: string; migrationBackup?: string } }>;
    saveCharacter: (character: { id: string; name: string }) => Promise<{ id: string; name: string }>;
    savePack: (pack: unknown) => Promise<unknown>;
    replaceStore: (store: unknown) => Promise<unknown>;
  };
};
const { assertContentPack } = require("./content-validation.cjs") as { assertContentPack: (pack: unknown) => void };

const temporaryDirectories: string[] = [];

async function testStorage(backupIntervalMs = 0) {
  const directory = await mkdtemp(path.join(tmpdir(), "azeroth-archives-storage-"));
  temporaryDirectories.push(directory);
  return createStorage({ getUserDataPath: () => directory, validatePack: assertContentPack, backupIntervalMs });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("desktop storage", () => {
  it("serializes overlapping character saves without losing records", async () => {
    const storage = await testStorage();
    await Promise.all(Array.from({ length: 20 }, (_, index) => storage.saveCharacter({ id: `hero-${index}`, name: `Hero ${index}` })));

    const store = await storage.load();
    expect(store.characters).toHaveLength(20);
    expect(new Set(store.characters.map((character) => character.id)).size).toBe(20);
  });

  it("recovers the newest valid rotating backup after corruption", async () => {
    const storage = await testStorage();
    await storage.saveCharacter({ id: "first", name: "First Hero" });
    await storage.saveCharacter({ id: "second", name: "Second Hero" });
    await writeFile(storage.dataPath(), "not json", "utf8");

    const recovered = await storage.load();
    expect(recovered.recovery?.restoredFrom).toMatch(/azeroth-archives-data-/);
    expect(recovered.characters.map((character) => character.id)).toEqual(["first"]);
  });

  it("creates a pre-migration backup and upgrades an old store", async () => {
    const storage = await testStorage();
    await writeFile(storage.dataPath(), JSON.stringify({ version: 1, characters: [{ id: "legacy", name: "Legacy" }] }), "utf8");

    const migrated = await storage.load();
    const backups = await readdir(storage.backupPath());
    expect(migrated.version).toBe(STORE_VERSION);
    expect(migrated.recovery?.migrationBackup).toMatch(/pre-migration-v1/);
    expect(backups.some((name) => name.includes("pre-migration-v1"))).toBe(true);
    expect(JSON.parse(await readFile(storage.dataPath(), "utf8")).version).toBe(STORE_VERSION);
  });

  it("rejects malformed packs and future-version stores", async () => {
    const storage = await testStorage();
    const malformedPack = { schemaVersion: "2.0", pack: { id: "bad-pack", name: "Bad Pack", version: "1" }, spells: {} };
    await expect(storage.savePack(malformedPack)).rejects.toThrow(/invalid content pack/i);
    await expect(storage.replaceStore({ version: STORE_VERSION, characters: [], packs: [malformedPack] })).rejects.toThrow(/invalid content pack/i);

    await writeFile(storage.dataPath(), JSON.stringify({ version: STORE_VERSION + 1, characters: [], packs: [] }), "utf8");
    await expect(storage.load()).rejects.toThrow(/newer version/i);
  });
});
