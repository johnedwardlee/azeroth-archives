const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("azerothDesktop", {
  load: () => ipcRenderer.invoke("storage:load"),
  saveCharacter: (character) => ipcRenderer.invoke("storage:save-character", character),
  deleteCharacter: (id) => ipcRenderer.invoke("storage:delete-character", id),
  savePack: (pack) => ipcRenderer.invoke("storage:save-pack", pack),
  deletePack: (id) => ipcRenderer.invoke("storage:delete-pack", id),
  setPackEnabled: (id, enabled) => ipcRenderer.invoke("storage:set-pack-enabled", id, enabled),
  saveCampaignState: (campaignState) => ipcRenderer.invoke("storage:save-campaign-state", campaignState),
  replaceStore: (store) => ipcRenderer.invoke("storage:replace", store),
  savePdf: (filename, bytes) => ipcRenderer.invoke("dialog:save-pdf", filename, bytes),
  saveJson: (filename, contents) => ipcRenderer.invoke("dialog:save-json", filename, contents),
  saveContentPack: (filename, contents) => ipcRenderer.invoke("dialog:save-content-pack", filename, contents),
  saveReviewJson: (filename, contents) => ipcRenderer.invoke("dialog:save-review-json", filename, contents),
  getAppInfo: () => ipcRenderer.invoke("app:info"),
  openDataFolder: () => ipcRenderer.invoke("app:open-data-folder"),
  openReleaseNotes: () => ipcRenderer.invoke("app:open-release-notes"),
  getUpdateStatus: () => ipcRenderer.invoke("updates:status"),
  checkForUpdates: () => ipcRenderer.invoke("updates:check"),
  installUpdate: () => ipcRenderer.invoke("updates:install"),
  onUpdateStatus: (callback) => {
    const listener = (_event, status) => callback(status);
    ipcRenderer.on("updates:status", listener);
    return () => ipcRenderer.removeListener("updates:status", listener);
  },
});
