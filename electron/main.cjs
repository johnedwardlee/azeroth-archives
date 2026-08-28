const { app, BrowserWindow, dialog, ipcMain, safeStorage, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const path = require("node:path");
const { assertContentPack } = require("./content-validation.cjs");
const { createStorage } = require("./storage.cjs");
const syncConfig = require("./sync-config.cjs");
const { createLiveSync } = require("./live-sync.cjs");
const { isAllowedNetworkRequest } = require("./network-policy.cjs");

let updateStatus = { state: "idle", version: null, percent: 0, message: "Updates are checked automatically." };

function publishUpdateStatus(patch) {
  updateStatus = { ...updateStatus, ...patch };
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("updates:status", updateStatus);
}

const storage = createStorage({
  getUserDataPath: () => app.getPath("userData"),
  validatePack: assertContentPack,
});

function publishLiveSyncEvent(event) {
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("live-sync:event", event);
}

const liveSync = createLiveSync({
  getUserDataPath: () => app.getPath("userData"),
  safeStorage,
  config: syncConfig,
  onEvent: publishLiveSyncEvent,
});

ipcMain.handle("storage:load", () => storage.load());
ipcMain.handle("storage:save-character", (_event, character) => storage.saveCharacter(character));
ipcMain.handle("storage:delete-character", (_event, id) => storage.deleteCharacter(id));
ipcMain.handle("storage:save-pack", (_event, pack) => storage.savePack(pack));
ipcMain.handle("storage:delete-pack", (_event, id) => storage.deletePack(id));
ipcMain.handle("storage:set-pack-enabled", (_event, id, enabled) => storage.setPackEnabled(id, enabled));
ipcMain.handle("storage:save-campaign-state", (_event, campaignState) => storage.saveCampaignState(campaignState));
ipcMain.handle("storage:save-sync-state", (_event, syncState) => storage.saveSyncState(syncState));
ipcMain.handle("storage:replace", (_event, replacement) => storage.replaceStore(replacement));
ipcMain.handle("live-sync:status", () => liveSync.status());
ipcMain.handle("live-sync:request-dm-link", (_event, email) => liveSync.requestDmMagicLink(email));
ipcMain.handle("live-sync:sign-out", () => liveSync.signOut());
ipcMain.handle("live-sync:list-campaigns", () => liveSync.listCampaigns());
ipcMain.handle("live-sync:create-campaign", (_event, name) => liveSync.createCampaign(name));
ipcMain.handle("live-sync:create-invitation", (_event, campaignId, characterId, validHours) => liveSync.createInvitation(campaignId, characterId, validHours));
ipcMain.handle("live-sync:redeem-invitation", (_event, code, character, playerName) => {
  const { portraitDataUrl: _portraitDataUrl, readOnlyReview: _readOnlyReview, reviewImportedAt: _reviewImportedAt, ...syncCharacter } = character;
  return liveSync.redeemInvitation(code, syncCharacter, playerName);
});
ipcMain.handle("live-sync:list-members", (_event, campaignId) => liveSync.listMembers(campaignId));
ipcMain.handle("live-sync:list-characters", (_event, campaignId) => liveSync.listCharacters(campaignId));
ipcMain.handle("live-sync:apply-mutation", (_event, mutation) => liveSync.applyMutation(mutation));
ipcMain.handle("live-sync:record-roll", (_event, roll) => liveSync.recordRoll(roll));
ipcMain.handle("live-sync:list-rolls", (_event, campaignId) => liveSync.listRolls(campaignId));
ipcMain.handle("live-sync:clear-rolls", (_event, campaignId) => liveSync.clearRolls(campaignId));
ipcMain.handle("live-sync:subscribe", (_event, campaignId, presence, characterId) => liveSync.subscribe(campaignId, presence, characterId));
ipcMain.handle("live-sync:unsubscribe", () => liveSync.unsubscribe());

ipcMain.handle("app:info", () => ({
  version: app.getVersion(),
  platform: `${process.platform} ${process.arch}`,
  packaged: app.isPackaged,
  dataPath: storage.dataPath(),
  backupPath: storage.backupPath(),
}));

ipcMain.handle("app:open-data-folder", () => shell.openPath(app.getPath("userData")));
ipcMain.handle("app:open-release-notes", () => shell.openExternal("https://github.com/johnedwardlee/azeroth-archives/releases"));
ipcMain.handle("updates:status", () => updateStatus);
ipcMain.handle("updates:check", async () => {
  if (!app.isPackaged) {
    publishUpdateStatus({ state: "development", message: "Update checks run in installed builds." });
    return updateStatus;
  }
  publishUpdateStatus({ state: "checking", percent: 0, message: "Checking GitHub for updates…" });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    publishUpdateStatus({ state: "error", message: error instanceof Error ? error.message : "Update check failed." });
  }
  return updateStatus;
});
ipcMain.handle("updates:install", () => {
  if (updateStatus.state === "ready") autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle("dialog:save-pdf", async (_event, filename, bytes) => {
  const result = await dialog.showSaveDialog({
    title: "Save character sheet",
    defaultPath: path.join(app.getPath("documents"), filename),
    filters: [{ name: "PDF document", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, Buffer.from(bytes));
  return result.filePath;
});

ipcMain.handle("dialog:save-json", async (_event, filename, contents) => {
  if (typeof filename !== "string" || !filename.trim()) throw new Error("A backup filename is required.");
  if (typeof contents !== "string") throw new Error("Backup contents must be text.");
  const result = await dialog.showSaveDialog({
    title: "Save character backup",
    defaultPath: path.join(app.getPath("documents"), filename),
    filters: [{ name: "Azeroth Archives character", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, contents, "utf8");
  return result.filePath;
});

ipcMain.handle("dialog:save-content-pack", async (_event, filename, contents) => {
  if (typeof filename !== "string" || !filename.trim()) throw new Error("A content-pack filename is required.");
  if (typeof contents !== "string") throw new Error("Content-pack contents must be text.");
  const result = await dialog.showSaveDialog({
    title: "Save Warcraft 5E content pack",
    defaultPath: path.join(app.getPath("documents"), filename),
    filters: [{ name: "Warcraft 5E content pack", extensions: ["w5e"] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, contents, "utf8");
  return result.filePath;
});

ipcMain.handle("dialog:save-review-json", async (_event, filename, contents) => {
  if (typeof filename !== "string" || !filename.trim()) throw new Error("A DM review filename is required.");
  if (typeof contents !== "string") throw new Error("DM review contents must be text.");
  const result = await dialog.showSaveDialog({
    title: "Export character for DM",
    defaultPath: path.join(app.getPath("documents"), filename),
    filters: [{ name: "Azeroth Archives DM review", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePath) return null;
  await fs.writeFile(result.filePath, contents, "utf8");
  return result.filePath;
});

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 920,
    minHeight: 680,
    backgroundColor: "#f2ead9",
    autoHideMenuBar: true,
    title: "Azeroth Archives",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  if (process.env.AZEROTH_DEV_URL) window.loadURL(process.env.AZEROTH_DEV_URL);
  else window.loadFile(path.join(__dirname, "..", "dist-renderer", "index.html"));
}

function configureAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => publishUpdateStatus({ state: "checking", percent: 0, message: "Checking GitHub for updates…" }));
  autoUpdater.on("update-available", (info) => publishUpdateStatus({ state: "downloading", version: info.version, percent: 0, message: `Downloading Azeroth Archives ${info.version}…` }));
  autoUpdater.on("update-not-available", (info) => publishUpdateStatus({ state: "current", version: info.version, percent: 100, message: "Azeroth Archives is up to date." }));
  autoUpdater.on("download-progress", (progress) => publishUpdateStatus({ state: "downloading", percent: Math.round(progress.percent), message: `Downloading update… ${Math.round(progress.percent)}%` }));

  autoUpdater.on("error", (error) => {
    console.error("Automatic update failed:", error);
    publishUpdateStatus({ state: "error", message: error.message || "Automatic update failed." });
  });

  autoUpdater.on("update-downloaded", async (updateInfo) => {
    publishUpdateStatus({ state: "ready", version: updateInfo.version, percent: 100, message: `Azeroth Archives ${updateInfo.version} is ready to install.` });
    const options = {
      type: "info",
      title: "Update ready",
      message: `Azeroth Archives ${updateInfo.version} is ready to install.`,
      detail: "Restart the app now to finish installing the update.",
      buttons: ["Restart and install", "Later"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    };
    const owner = BrowserWindow.getFocusedWindow();
    const result = owner
      ? await dialog.showMessageBox(owner, options)
      : await dialog.showMessageBox(options);

    if (result.response === 0) autoUpdater.quitAndInstall(false, true);
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((error) => {
      console.error("Unable to check for updates:", error);
    });
  }, 10_000);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
let pendingAuthUrl = process.argv.find((argument) => argument.startsWith("azeroth-archives://"));

function focusMainWindow() {
  const window = BrowserWindow.getAllWindows()[0];
  if (!window) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}

async function handleAuthUrl(authUrl) {
  if (!authUrl?.startsWith("azeroth-archives://")) return;
  try {
    await liveSync.handleAuthCallback(authUrl);
  } catch (error) {
    publishLiveSyncEvent({ type: "auth-error", message: error instanceof Error ? error.message : "DM sign-in failed." });
  }
  focusMainWindow();
}

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  if (process.defaultApp && process.argv[1]) app.setAsDefaultProtocolClient("azeroth-archives", process.execPath, [path.resolve(process.argv[1])]);
  else app.setAsDefaultProtocolClient("azeroth-archives");

  app.on("second-instance", (_event, commandLine) => {
    const authUrl = commandLine.find((argument) => argument.startsWith("azeroth-archives://"));
    if (authUrl) handleAuthUrl(authUrl);
    else focusMainWindow();
  });

  app.on("open-url", (event, authUrl) => {
    event.preventDefault();
    if (app.isReady()) handleAuthUrl(authUrl);
    else pendingAuthUrl = authUrl;
  });

  app.whenReady().then(async () => {
    await liveSync.initialize();
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] },
      (details, callback) => {
        callback({ cancel: !isAllowedNetworkRequest(details.url, { devUrl: process.env.AZEROTH_DEV_URL, packaged: app.isPackaged, supabaseUrl: syncConfig.supabaseUrl }) });
      },
    );
    createWindow();
    if (pendingAuthUrl) {
      const authUrl = pendingAuthUrl;
      pendingAuthUrl = undefined;
      await handleAuthUrl(authUrl);
    }
    configureAutoUpdater();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
