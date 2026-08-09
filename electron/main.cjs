const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs/promises");
const path = require("node:path");

const UPDATE_HOSTS = new Set(["api.github.com", "github.com"]);

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

const emptyStore = () => ({ version: 1, characters: [], packs: [] });
const dataPath = () => path.join(app.getPath("userData"), "azeroth-archives-data.json");

async function readStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(dataPath(), "utf8"));
    return {
      version: 1,
      characters: Array.isArray(parsed.characters) ? parsed.characters : [],
      packs: Array.isArray(parsed.packs) ? parsed.packs : [],
    };
  } catch (error) {
    if (error?.code === "ENOENT") return emptyStore();
    throw error;
  }
}

async function writeStore(store) {
  const destination = dataPath();
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.tmp`;
  await fs.writeFile(temporary, JSON.stringify(store, null, 2), "utf8");
  await fs.rename(temporary, destination);
}

function requireId(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} id is required.`);
  return value.trim();
}

ipcMain.handle("storage:load", () => readStore());

ipcMain.handle("storage:save-character", async (_event, character) => {
  requireId(character?.id, "Character");
  if (typeof character?.name !== "string" || !character.name.trim()) throw new Error("Character name is required.");
  const store = await readStore();
  const saved = { ...character, name: character.name.trim(), updatedAt: new Date().toISOString() };
  store.characters = [saved, ...store.characters.filter((item) => item.id !== saved.id)];
  await writeStore(store);
  return saved;
});

ipcMain.handle("storage:delete-character", async (_event, id) => {
  id = requireId(id, "Character");
  const store = await readStore();
  store.characters = store.characters.filter((item) => item.id !== id);
  await writeStore(store);
});

ipcMain.handle("storage:save-pack", async (_event, pack) => {
  const id = requireId(pack?.pack?.id, "Content pack");
  if (!new Set(["1.0", "2.0"]).has(pack?.schemaVersion)) throw new Error("Unsupported content pack version.");
  const store = await readStore();
  store.packs = [pack, ...store.packs.filter((item) => item.pack.id !== id)];
  await writeStore(store);
  return pack;
});

ipcMain.handle("storage:delete-pack", async (_event, id) => {
  id = requireId(id, "Content pack");
  const store = await readStore();
  store.packs = store.packs.filter((item) => item.pack.id !== id);
  await writeStore(store);
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
    backgroundColor: "#f4f1e8",
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

  autoUpdater.on("error", (error) => {
    console.error("Automatic update failed:", error);
  });

  autoUpdater.on("update-downloaded", async (updateInfo) => {
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
