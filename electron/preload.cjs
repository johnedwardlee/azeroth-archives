const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("azerothDesktop", {
  load: () => ipcRenderer.invoke("storage:load"),
  saveCharacter: (character) => ipcRenderer.invoke("storage:save-character", character),
  deleteCharacter: (id) => ipcRenderer.invoke("storage:delete-character", id),
  savePack: (pack) => ipcRenderer.invoke("storage:save-pack", pack),
  deletePack: (id) => ipcRenderer.invoke("storage:delete-pack", id),
  setPackEnabled: (id, enabled) => ipcRenderer.invoke("storage:set-pack-enabled", id, enabled),
  saveCampaignState: (campaignState) => ipcRenderer.invoke("storage:save-campaign-state", campaignState),
  saveSyncState: (syncState) => ipcRenderer.invoke("storage:save-sync-state", syncState),
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
  getLiveSyncStatus: () => ipcRenderer.invoke("live-sync:status"),
  requestDmMagicLink: (email) => ipcRenderer.invoke("live-sync:request-dm-link", email),
  signOutLiveSync: () => ipcRenderer.invoke("live-sync:sign-out"),
  listLiveCampaigns: () => ipcRenderer.invoke("live-sync:list-campaigns"),
  createLiveCampaign: (name) => ipcRenderer.invoke("live-sync:create-campaign", name),
  createCampaignInvitation: (campaignId, characterId, validHours) => ipcRenderer.invoke("live-sync:create-invitation", campaignId, characterId, validHours),
  redeemCampaignInvitation: (code, character, playerName) => ipcRenderer.invoke("live-sync:redeem-invitation", code, character, playerName),
  listCampaignMembers: (campaignId) => ipcRenderer.invoke("live-sync:list-members", campaignId),
  listSyncedCharacters: (campaignId) => ipcRenderer.invoke("live-sync:list-characters", campaignId),
  applyCharacterMutation: (mutation) => ipcRenderer.invoke("live-sync:apply-mutation", mutation),
  publishRollEvent: (roll) => ipcRenderer.invoke("live-sync:record-roll", roll),
  listCampaignRolls: (campaignId) => ipcRenderer.invoke("live-sync:list-rolls", campaignId),
  clearCampaignRolls: (campaignId) => ipcRenderer.invoke("live-sync:clear-rolls", campaignId),
  subscribeLiveCampaign: (campaignId, presence, characterId) => ipcRenderer.invoke("live-sync:subscribe", campaignId, presence, characterId),
  unsubscribeLiveCampaign: () => ipcRenderer.invoke("live-sync:unsubscribe"),
  onLiveSyncEvent: (callback) => {
    const listener = (_event, syncEvent) => callback(syncEvent);
    ipcRenderer.on("live-sync:event", listener);
    return () => ipcRenderer.removeListener("live-sync:event", listener);
  },
});
