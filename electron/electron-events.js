const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return [];

  const folderPath = result.filePaths[0];
  const files = fs.readdirSync(folderPath)
    .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .map(f => `file://${path.join(folderPath, f)}`);
  return files;
});