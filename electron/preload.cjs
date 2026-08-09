const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("azerothDesktop", {
  load: () => ipcRenderer.invoke("storage:load"),
  saveCharacter: (character) => ipcRenderer.invoke("storage:save-character", character),
  deleteCharacter: (id) => ipcRenderer.invoke("storage:delete-character", id),
  savePack: (pack) => ipcRenderer.invoke("storage:save-pack", pack),
  deletePack: (id) => ipcRenderer.invoke("storage:delete-pack", id),
  savePdf: (filename, bytes) => ipcRenderer.invoke("dialog:save-pdf", filename, bytes),
});
