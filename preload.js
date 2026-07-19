const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAll: () => ipcRenderer.invoke('store:getAll'),
  saveEntry: (entry) => ipcRenderer.invoke('store:saveEntry', entry),
  deleteEntry: (id) => ipcRenderer.invoke('store:deleteEntry', id),
  saveNote: (note) => ipcRenderer.invoke('store:saveNote', note),
  deleteNote: (id) => ipcRenderer.invoke('store:deleteNote', id),
  getVersion: () => ipcRenderer.invoke('app:version'),
  loadData: () => ipcRenderer.invoke('data:load'),
  getHomebrew: () => ipcRenderer.invoke('homebrew:get'),
  saveHomebrew: (h) => ipcRenderer.invoke('homebrew:save', h),
  exportHomebrew: () => ipcRenderer.invoke('homebrew:export'),
  importHomebrew: () => ipcRenderer.invoke('homebrew:import')
});
