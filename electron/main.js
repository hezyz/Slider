const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { globalShortcut } = require('electron');

app.whenReady().then(() => {
  const win = createWindow();

  globalShortcut.register('CommandOrControl+R', () => {
    win.webContents.reload(); // manually refresh Electron window
  });
});

function createWindow() {
  const win = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    webSecurity: false  // ✅ this allows loading local file:// URLs
  }
});

  win.loadURL('http://localhost:4200'); // dev mode
  // win.loadFile(path.join(__dirname, '../dist/index.html')); // prod mode
}

app.whenReady().then(() => {
  createWindow();
});


// Register all IPC handlers
require('./electron-events');