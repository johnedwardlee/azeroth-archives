const fs = require("node:fs/promises");
const path = require("node:path");

const STORE_VERSION = 4;
const DEFAULT_BACKUP_LIMIT = 10;
const DEFAULT_BACKUP_INTERVAL_MS = 5 * 60 * 1000;

function requireId(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} id is required.`);
  return value.trim();
}

function migrateStore(value) {
  const parsed = value && typeof value === "object" ? value : {};
  const sourceVersion = Number.isInteger(parsed.version) ? parsed.version : 1;
  if (sourceVersion > STORE_VERSION) {
    const error = new Error(`This data was created by a newer version of Azeroth Archives (store version ${sourceVersion}).`);
    error.code = "STORE_VERSION_TOO_NEW";
    throw error;
  }

  let migrated = {
    version: Math.max(1, sourceVersion),
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    packs: Array.isArray(parsed.packs) ? parsed.packs : [],
    disabledPackIds: Array.isArray(parsed.disabledPackIds) ? parsed.disabledPackIds.filter((id) => typeof id === "string") : [],
  };

  if (migrated.version === 1) {
    migrated = { ...migrated, version: 2, packs: Array.isArray(migrated.packs) ? migrated.packs : [] };
  }
  if (migrated.version === 2) {
    migrated = { ...migrated, version: 3 };
  }
  if (migrated.version === 3) {
    migrated = { ...migrated, version: 4, disabledPackIds: [] };
  }

  return { store: migrated, sourceVersion, migrated: sourceVersion !== STORE_VERSION };
}

function createStorage({
  getUserDataPath,
  validatePack,
  backupLimit = DEFAULT_BACKUP_LIMIT,
  backupIntervalMs = DEFAULT_BACKUP_INTERVAL_MS,
}) {
  if (typeof getUserDataPath !== "function") throw new Error("getUserDataPath is required.");
  if (typeof validatePack !== "function") throw new Error("validatePack is required.");

  const dataPath = () => path.join(getUserDataPath(), "azeroth-archives-data.json");
  const backupPath = () => path.join(getUserDataPath(), "backups");
  let operationQueue = Promise.resolve();

  function enqueue(operation) {
    const result = operationQueue.then(operation, operation);
    operationQueue = result.catch(() => undefined);
    return result;
  }

  async function availableBackups() {
    try {
      const names = await fs.readdir(backupPath());
      return names.filter((name) => /^azeroth-archives-data-.*\.json$/i.test(name)).sort().reverse();
    } catch (error) {
      if (error?.code === "ENOENT") return [];
      throw error;
    }
  }

  async function pruneBackups() {
    const backups = await availableBackups();
    await Promise.all(backups.slice(backupLimit).map((name) => fs.unlink(path.join(backupPath(), name))));
  }

  function timestamp() {
    return new Date().toISOString().replace(/[:.]/g, "-");
  }

  async function createMigrationBackup(contents, sourceVersion) {
    await fs.mkdir(backupPath(), { recursive: true });
    const filename = `azeroth-archives-data-${timestamp()}-pre-migration-v${sourceVersion}.json`;
    await fs.writeFile(path.join(backupPath(), filename), contents, "utf8");
    await pruneBackups();
    return filename;
  }

  async function createRotatingBackup(destination) {
    try {
      await fs.access(destination);
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
    await fs.mkdir(backupPath(), { recursive: true });
    const existing = await availableBackups();
    if (existing[0]) {
      const latest = await fs.stat(path.join(backupPath(), existing[0]));
      if (Date.now() - latest.mtimeMs < backupIntervalMs) return;
    }
    await fs.copyFile(destination, path.join(backupPath(), `azeroth-archives-data-${timestamp()}.json`));
    await pruneBackups();
  }

  function validateStore(store) {
    if (!store || !Array.isArray(store.characters) || !Array.isArray(store.packs) || !Array.isArray(store.disabledPackIds)) {
      throw new Error("The character library must contain character and content-pack lists.");
    }
    for (const pack of store.packs) validatePack(pack);
    return store;
  }

  async function writeStoreUnlocked(store, createBackup = true) {
    const destination = dataPath();
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (createBackup) await createRotatingBackup(destination);
    const temporary = `${destination}.tmp`;
    const normalized = validateStore({ version: STORE_VERSION, characters: store.characters, packs: store.packs, disabledPackIds: store.disabledPackIds ?? [] });
    await fs.writeFile(temporary, JSON.stringify(normalized, null, 2), "utf8");
    await fs.rename(temporary, destination);
  }

  async function recoverStore() {
    for (const name of await availableBackups()) {
      try {
        const parsed = JSON.parse(await fs.readFile(path.join(backupPath(), name), "utf8"));
        const { store } = migrateStore(parsed);
        validateStore(store);
        await writeStoreUnlocked(store, false);
        return { ...store, recovery: { restoredFrom: name } };
      } catch {
        // Continue to the next rotating backup.
      }
    }
    return null;
  }

  async function readStoreUnlocked() {
    try {
      const contents = await fs.readFile(dataPath(), "utf8");
      const parsed = JSON.parse(contents);
      const result = migrateStore(parsed);
      validateStore(result.store);
      if (result.migrated) {
        const migrationBackup = await createMigrationBackup(contents, result.sourceVersion);
        await writeStoreUnlocked(result.store, false);
        return { ...result.store, recovery: { migrationBackup } };
      }
      return result.store;
    } catch (error) {
      if (error?.code === "ENOENT") return { version: STORE_VERSION, characters: [], packs: [], disabledPackIds: [] };
      if (error?.code === "STORE_VERSION_TOO_NEW") throw error;
      const recovered = await recoverStore();
      if (recovered) return recovered;
      throw new Error("Character data is unreadable and no valid automatic backup is available.", { cause: error });
    }
  }

  return {
    dataPath,
    backupPath,
    load: () => enqueue(() => readStoreUnlocked()),
    saveCharacter: (character) => enqueue(async () => {
      requireId(character?.id, "Character");
      if (typeof character?.name !== "string" || !character.name.trim()) throw new Error("Character name is required.");
      const store = await readStoreUnlocked();
      const saved = { ...character, name: character.name.trim(), updatedAt: new Date().toISOString() };
      store.characters = [saved, ...store.characters.filter((item) => item.id !== saved.id)];
      await writeStoreUnlocked(store);
      return saved;
    }),
    deleteCharacter: (id) => enqueue(async () => {
      id = requireId(id, "Character");
      const store = await readStoreUnlocked();
      store.characters = store.characters.filter((item) => item.id !== id);
      await writeStoreUnlocked(store);
    }),
    savePack: (pack) => enqueue(async () => {
      validatePack(pack);
      const id = requireId(pack?.pack?.id, "Content pack");
      const store = await readStoreUnlocked();
      store.packs = [pack, ...store.packs.filter((item) => item.pack.id !== id)];
      await writeStoreUnlocked(store);
      return pack;
    }),
    deletePack: (id) => enqueue(async () => {
      id = requireId(id, "Content pack");
      const store = await readStoreUnlocked();
      store.packs = store.packs.filter((item) => item.pack.id !== id);
      store.disabledPackIds = store.disabledPackIds.filter((item) => item !== id);
      await writeStoreUnlocked(store);
    }),
    setPackEnabled: (id, enabled) => enqueue(async () => {
      id = requireId(id, "Content pack");
      const store = await readStoreUnlocked();
      store.disabledPackIds = enabled
        ? store.disabledPackIds.filter((item) => item !== id)
        : [...new Set([...store.disabledPackIds, id])];
      await writeStoreUnlocked(store);
      return { id, enabled: Boolean(enabled) };
    }),
    replaceStore: (replacement) => enqueue(async () => {
      const result = migrateStore(replacement);
      validateStore(result.store);
      await writeStoreUnlocked(result.store);
      return result.store;
    }),
  };
}

module.exports = { createStorage, migrateStore, STORE_VERSION };
