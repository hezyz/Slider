const { ipcMain, dialog, app } = require('electron');
const fs = require('fs');
const path = require('path');

// You need to get a reference to your main window - adjust this based on your main.js setup
let mainWindow;

// Add this function to set the main window reference
function setMainWindow(window) {
  mainWindow = window;
}

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
    // Create files folder for videos/audio
    fs.mkdirSync(path.join(projectPath, 'files'));

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

// Import slide images
ipcMain.handle('import-images', async (_event, projectName) => {
  try {
    const basePath = path.join(__dirname, '..', 'projects');
    const projectPath = path.join(basePath, projectName);
    console.log('Creating project at:', projectPath);
    const result = await dialog.showOpenDialog({
      title: 'Select images to import',
      defaultPath: app.getPath('home'),
      buttonLabel: 'Select',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }]
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: 'No files selected.' };
    }

    const images = [];
    const slidesFolder = path.join(projectPath, 'slides');

    if (!fs.existsSync(slidesFolder)) {
      fs.mkdirSync(slidesFolder, { recursive: true });
    }

    const copiedFiles = [];

    for (const sourcePath of result.filePaths) {
      const fileName = path.basename(sourcePath);
      const destPath = path.join(slidesFolder, fileName);

      // ✅ Check if file exists and ask to overwrite
      if (fs.existsSync(destPath)) {
        const { response } = await dialog.showMessageBox({
          type: 'question',
          buttons: ['Overwrite', 'Skip'],
          defaultId: 1,
          cancelId: 1,
          title: 'File already exists',
          message: `The file "${fileName}" already exists. Do you want to overwrite it?`
        });

        if (response !== 0) {
          continue; // Skip file if not overwriting
        }
      }

      fs.copyFileSync(sourcePath, destPath);
      copiedFiles.push(destPath);
      images.push({ fileName, path: `slider/${fileName}` });
    }

    // ✅ Update project.json
    const settingsPath = path.join(projectPath, 'project.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    // Preserve previous slides and avoid duplicates by fileName
    const existingSlides = Array.isArray(settings.slides) ? settings.slides : [];
    const mergedSlidesMap = new Map();

    // Add old slides first
    for (const slide of existingSlides) {
      mergedSlidesMap.set(slide.fileName, slide);
    }

    // Add/overwrite new ones
    for (const slide of images) {
      mergedSlidesMap.set(slide.fileName, slide);
    }

    settings.updatedOn = new Date().toISOString();
    settings.slides = Array.from(mergedSlidesMap.values());

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

    return { success: true, images: copiedFiles };
  } catch (err) {
    console.error('Error copying images:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-project-images', async (_event, projectName) => {
  try {
    const rootPath = path.join(__dirname, '..'); // 👈 Go up one level from /electron
    const slidesFolder = path.join(rootPath, 'projects', projectName, 'slides');

    if (!fs.existsSync(slidesFolder)) {
      return { success: false, error: slidesFolder };
    }

    const files = await fs.promises.readdir(slidesFolder);
    const imageFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
    });

    const fullPaths = imageFiles.map(file => path.join(slidesFolder, file));

    return { success: true, files: fullPaths };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('copy-file-and-create-segments', async (_event, { sourcePath, projectName }) => {
  try {
    const basePath = path.join(__dirname, '..', 'projects', projectName);

    // Ensure project folder exists
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    // Copy the file
    const fileName = path.basename(sourcePath);
    const targetFilePath = path.join(basePath, fileName);
    fs.copyFileSync(sourcePath, targetFilePath);

    return { success: true, message: 'File copied.', targetFilePath };
  } catch (error) {
    console.error('Error in copy-file:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('write-json-file', async (_event, projectName, fileName, data) => {
  try {
    const basePath = path.join(__dirname, '..', 'projects', projectName);

    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }

    const safeFileName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    const filePath = path.join(basePath, safeFileName);

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true, path: filePath };
  } catch (err) {
    console.error(`❌ Error writing ${fileName}:`, err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('write-corrections-json-file', async (_event, filePath, data) => {
  try {

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

    return { success: true, path: filePath };
  } catch (err) {
    console.error(`❌ Error writing ${fileName}:`, err);
    return { success: false, error: err.message };
  }
});

// Get project path
ipcMain.handle('get-project-path', async (_event, projectName) => {
  try {
    const projectsBasePath = path.join(__dirname, '..', 'projects');
    const projectPath = path.join(projectsBasePath, projectName);
    
    if (!fs.existsSync(projectPath)) {
      return { success: false, error: 'Project does not exist' };
    }
    
    return { success: true, path: projectPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Get app path
ipcMain.handle('get-app-path', async (_event) => {
  try {
    const projectsPath = path.join(__dirname, '..', 'projects');
    
    if (!fs.existsSync(projectsPath)) {
      return { success: false, error: 'Projects directory does not exist' };
    }

    return { success: true, path: projectsPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Export the setMainWindow function so you can call it from your main.js
module.exports = { setMainWindow };