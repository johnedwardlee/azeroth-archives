const fs = require("node:fs/promises");
const path = require("node:path");
const { assertCharacter } = require("./character-validation.cjs");
const { assertCampaignProfile } = require("./campaign-validation.cjs");

const STORE_VERSION = 6;
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
    campaignProfiles: Array.isArray(parsed.campaignProfiles) ? parsed.campaignProfiles : [],
    activeCampaignProfileId: typeof parsed.activeCampaignProfileId === "string" ? parsed.activeCampaignProfileId : undefined,
    onboardingCompleted: typeof parsed.onboardingCompleted === "boolean" ? parsed.onboardingCompleted : false,
    appRole: parsed.appRole === "dm" ? "dm" : "player",
    syncLinks: Array.isArray(parsed.syncLinks) ? parsed.syncLinks : [],
    syncOutbox: Array.isArray(parsed.syncOutbox) ? parsed.syncOutbox : [],
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
  if (migrated.version === 4) {
    migrated = { ...migrated, version: 5, campaignProfiles: [], activeCampaignProfileId: undefined, onboardingCompleted: migrated.characters.length > 0, appRole: "player" };
  }
  if (migrated.version === 5) {
    migrated = { ...migrated, version: 6, syncLinks: [], syncOutbox: [] };
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
    if (!store || !Array.isArray(store.characters) || !Array.isArray(store.packs) || !Array.isArray(store.disabledPackIds) || !Array.isArray(store.campaignProfiles) || !Array.isArray(store.syncLinks) || !Array.isArray(store.syncOutbox)) {
      throw new Error("The character library must contain character and content-pack lists.");
    }
    for (const pack of store.packs) validatePack(pack);
    for (const profile of store.campaignProfiles) assertCampaignProfile(profile);
    if (store.activeCampaignProfileId !== undefined && (typeof store.activeCampaignProfileId !== "string" || !store.campaignProfiles.some((profile) => profile.id === store.activeCampaignProfileId))) throw new Error("The active campaign profile is invalid.");
    if (typeof store.onboardingCompleted !== "boolean") throw new Error("The onboarding state is invalid.");
    if (!["player", "dm"].includes(store.appRole)) throw new Error("The app role is invalid.");
    const characterIds = new Set(store.characters.map((character) => character.id));
    for (const link of store.syncLinks) {
      if (!link || typeof link.characterId !== "string" || !characterIds.has(link.characterId) || typeof link.campaignId !== "string" || !link.campaignId || !["player", "dm"].includes(link.role) || !Number.isInteger(link.revision) || link.revision < 1) throw new Error("A character sync link is invalid.");
    }
    for (const entry of store.syncOutbox) {
      if (!entry || typeof entry.id !== "string" || !entry.id || typeof entry.characterId !== "string" || !characterIds.has(entry.characterId) || !["character-mutation", "roll-event"].includes(entry.kind) || typeof entry.createdAt !== "string") throw new Error("A sync outbox entry is invalid.");
    }
    return store;
  }

  async function writeStoreUnlocked(store, createBackup = true) {
    const destination = dataPath();
    await fs.mkdir(path.dirname(destination), { recursive: true });
    if (createBackup) await createRotatingBackup(destination);
    const temporary = `${destination}.tmp`;
    const normalized = validateStore({
      version: STORE_VERSION,
      characters: store.characters,
      packs: store.packs,
      disabledPackIds: store.disabledPackIds ?? [],
      campaignProfiles: store.campaignProfiles ?? [],
      activeCampaignProfileId: store.activeCampaignProfileId,
      onboardingCompleted: Boolean(store.onboardingCompleted),
      appRole: store.appRole === "dm" ? "dm" : "player",
      syncLinks: store.syncLinks ?? [],
      syncOutbox: store.syncOutbox ?? [],
    });
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
      if (error?.code === "ENOENT") return { version: STORE_VERSION, characters: [], packs: [], disabledPackIds: [], campaignProfiles: [], activeCampaignProfileId: undefined, onboardingCompleted: false, appRole: "player", syncLinks: [], syncOutbox: [] };
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
      assertCharacter(character);
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
    saveCampaignState: (campaignState) => enqueue(async () => {
      const store = await readStoreUnlocked();
      const candidate = {
        campaignProfiles: Array.isArray(campaignState?.campaignProfiles) ? campaignState.campaignProfiles : [],
        activeCampaignProfileId: typeof campaignState?.activeCampaignProfileId === "string" ? campaignState.activeCampaignProfileId : undefined,
        onboardingCompleted: Boolean(campaignState?.onboardingCompleted),
        appRole: campaignState?.appRole === "dm" ? "dm" : "player",
      };
      candidate.campaignProfiles.forEach(assertCampaignProfile);
      if (candidate.activeCampaignProfileId && !candidate.campaignProfiles.some((profile) => profile.id === candidate.activeCampaignProfileId)) throw new Error("The active campaign profile is invalid.");
      Object.assign(store, candidate);
      await writeStoreUnlocked(store);
      return candidate;
    }),
    saveSyncState: (syncState) => enqueue(async () => {
      const store = await readStoreUnlocked();
      store.syncLinks = Array.isArray(syncState?.syncLinks) ? syncState.syncLinks : [];
      store.syncOutbox = Array.isArray(syncState?.syncOutbox) ? syncState.syncOutbox : [];
      validateStore(store);
      await writeStoreUnlocked(store);
      return { syncLinks: store.syncLinks, syncOutbox: store.syncOutbox };
    }),
    replaceStore: (replacement) => enqueue(async () => {
      const result = migrateStore(replacement);
      validateStore(result.store);
      for (const character of result.store.characters) assertCharacter(character);
      await writeStoreUnlocked(result.store);
      return result.store;
    }),
  };
}

module.exports = { createStorage, migrateStore, STORE_VERSION };
