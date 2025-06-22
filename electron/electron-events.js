const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');

//create new project 

ipcMain.handle('create-project', async (_event, projectName) => {
  try {
    const projectsBasePath = path.join(__dirname, '..', 'projects');
    if (!fs.existsSync(projectsBasePath)) {
      fs.mkdirSync(projectsBasePath);
    }

    const projectPath = path.join(projectsBasePath, projectName);

    if (fs.existsSync(projectPath)) {
      return { success: false, error: 'Project already exists' };
    }

    fs.mkdirSync(projectPath);
    fs.mkdirSync(path.join(projectPath, 'slides'));
    // fs.writeFileSync(path.join(projectPath, 'project.json'), JSON.stringify({}, null, 2), 'utf-8');

    // Write initial project.json
    const settingsPath = path.join(projectPath, 'project.json');
    const initialData = {
      name: projectName,
      createdAt: new Date().toISOString(),
      updatedOn: new Date().toISOString(),
      path: projectPath,
      slides: [],
    };
    fs.writeFileSync(settingsPath, JSON.stringify(initialData, null, 2), 'utf-8');

    return { success: true, path: projectPath };
  } catch (err) {
    console.error('Error creating project:', err);
    return { success: false, error: err.message };
  }
});

// Select json file 
ipcMain.handle('select-json-file', async () => {
  const projectPath = path.join(__dirname, '..', 'projects'); 
  const result = await dialog.showOpenDialog({
    title: 'Select a JSON file',
    defaultPath: projectPath, 
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  return { canceled: false, filePath: result.filePaths[0] };
});

// Read json file

ipcMain.handle('read-json-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const json = JSON.parse(content);
    return { success: true, data: json };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
// Open project dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return [];

  const folderPath = result.filePaths[0];
  const files = fs.readdirSync(folderPath)
    .filter(f => /\.(jpg|jpeg|png|gif)$/i.test(f))
    .map(f => `file://${path.join(folderPath, f)}`);
  return files;
});