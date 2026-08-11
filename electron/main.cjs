const { app, BrowserWindow, dialog, ipcMain, session, shell } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const path = require("node:path");
const { assertContentPack } = require("./content-validation.cjs");
const { createStorage } = require("./storage.cjs");

const UPDATE_HOSTS = new Set(["api.github.com", "github.com"]);
let updateStatus = { state: "idle", version: null, percent: 0, message: "Updates are checked automatically." };

function publishUpdateStatus(patch) {
  updateStatus = { ...updateStatus, ...patch };
  for (const window of BrowserWindow.getAllWindows()) window.webContents.send("updates:status", updateStatus);
}

function isAllowedNetworkRequest(requestUrl) {
  const devUrl = process.env.AZEROTH_DEV_URL;
  if (devUrl && requestUrl.startsWith(devUrl)) return true;

  try {
    const url = new URL(requestUrl);
    return (
      app.isPackaged &&
      url.protocol === "https:" &&
      (UPDATE_HOSTS.has(url.hostname) || url.hostname.endsWith(".githubusercontent.com"))
    );
  } catch {
    return false;
  }
}

const storage = createStorage({
  getUserDataPath: () => app.getPath("userData"),
  validatePack: assertContentPack,
});

ipcMain.handle("storage:load", () => storage.load());
ipcMain.handle("storage:save-character", (_event, character) => storage.saveCharacter(character));
ipcMain.handle("storage:delete-character", (_event, id) => storage.deleteCharacter(id));
ipcMain.handle("storage:save-pack", (_event, pack) => storage.savePack(pack));
ipcMain.handle("storage:delete-pack", (_event, id) => storage.deletePack(id));
ipcMain.handle("storage:replace", (_event, replacement) => storage.replaceStore(replacement));

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

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) return;
    if (window.isMinimized()) window.restore();
    window.show();
    window.focus();
  });

  app.whenReady().then(() => {
    session.defaultSession.webRequest.onBeforeRequest(
      { urls: ["http://*/*", "https://*/*"] },
      (details, callback) => {
        callback({ cancel: !isAllowedNetworkRequest(details.url) });
      },
    );
    createWindow();
    configureAutoUpdater();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
