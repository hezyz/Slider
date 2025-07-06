const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

let mainWindow;

// Disable security warnings in development
if (!app.isPackaged) {
  process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
}

// Ensure only one instance runs
const gotTheLock = app.requestSingleInstanceLock();

function createWindow() {
  console.log('🧠 Electron createWindow() called');

  mainWindow = new BrowserWindow({
    width: 1500,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      webSecurity: false, // WARNING: set to true for production!
      allowRunningInsecureContent: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.webContents.openDevTools();
   const indexPath = path.join(__dirname, '../browser/browser/index.html');
    console.log('Loading index.html from:', indexPath);
    mainWindow.loadFile(indexPath);

  }
}

if (!gotTheLock) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createWindow();

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

  require('./electron-events'); // ✅ Register IPC handlers
}

// Clean exit
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
