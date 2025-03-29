
const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');
const { autoUpdater } = require("electron-updater");
const log = require('electron-log');
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('public/index.html');
  win.webContents.openDevTools({ mode: 'detach' });


  globalShortcut.register('Control+Alt+C', () => {
    win.webContents.send('shortcut-copy');
  });

  globalShortcut.register('Control+Alt+V', () => {
    win.webContents.send('shortcut-paste');
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  autoUpdater.checkForUpdatesAndNotify();
});

autoUpdater.on("update-not-available", () => {
  console.log("Nessun aggiornamento disponibile");
});

autoUpdater.on("update-available", () => {
  console.log("🔄 Aggiornamento disponibile");
});

autoUpdater.on("update-downloaded", () => {
  console.log("✅ Update scaricato. Verrà installato al riavvio.");
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
