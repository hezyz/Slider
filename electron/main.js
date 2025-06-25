const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

if (!app.isPackaged) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

if (app.isPackaged) {
  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
}
// Only allow single instance
const gotTheLock = app.requestSingleInstanceLock();

function createWindow() {
  console.log('🧠 Electron createWindow() called');

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools(); // dev only
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

if (!gotTheLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createWindow(); // ✅ ONLY called here

    globalShortcut.register('CommandOrControl+R', () => {
      if (mainWindow) mainWindow.webContents.reload();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  require('./electron-events'); // Register IPC handlers
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
