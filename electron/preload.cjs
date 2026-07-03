'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),
  getPaths: () => ipcRenderer.invoke('get-paths'),

  // File-system storage (~/Documents/Enginguity/data/)
  saveData: (key, data) => ipcRenderer.invoke('save-data', key, data),
  loadData: (key) => ipcRenderer.invoke('load-data', key),
  deleteData: (key) => ipcRenderer.invoke('delete-data', key),
  listDataFiles: () => ipcRenderer.invoke('list-data-files'),

  // Folder access
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  openPath: (p) => ipcRenderer.invoke('open-path', p),

  // Native dialogs
  openDialog: (opts) => ipcRenderer.invoke('dialog-open', opts),
  saveDialog: (opts) => ipcRenderer.invoke('dialog-save', opts),

  // Events pushed from main → renderer
  onMenuOpenSettings: (cb) => {
    ipcRenderer.on('menu-open-settings', cb)
    return () => ipcRenderer.removeListener('menu-open-settings', cb)
  },
})
