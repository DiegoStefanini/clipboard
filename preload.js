
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onShortcutCopy: (callback) => ipcRenderer.on('shortcut-copy', callback),
  onShortcutPaste: (callback) => ipcRenderer.on('shortcut-paste', callback)
});
