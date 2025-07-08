const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  createProject: (name) => ipcRenderer.invoke('create-project', name),
  selectJsonFile: async () => { return await ipcRenderer.invoke('select-json-file'); },
  readJsonFile: async (filePath) => { return await ipcRenderer.invoke('read-json-file', filePath); },
  importImages: (projectName) => ipcRenderer.invoke('import-images', projectName),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getProjectImages: async (projectName) => { return await ipcRenderer.invoke('get-project-images', projectName); },
  copyFileAndCreateSegments: (data) => ipcRenderer.invoke('copy-file-and-create-segments', data),
  writeJsonFile: (projectName, fileName, data) => ipcRenderer.invoke('write-json-file', projectName, fileName, data),
  getProjectPath: (projectName) => ipcRenderer.invoke('get-project-path', projectName),

  // Python IPC
  // Enhanced Python IPC with progress tracking
  runAudioExtraction: (inputPath, outputPath) => ipcRenderer.invoke('run-audio-extraction', { inputPath, outputPath }),
  checkPythonDependencies: () => ipcRenderer.invoke('check-python-dependencies'),

  // Event listeners for progress tracking
  onAudioExtractionProgress: (callback) => {
    ipcRenderer.on('audio-extraction-progress', (event, data) => callback(data));
  },
  onAudioExtractionStatus: (callback) => {
    ipcRenderer.on('audio-extraction-status', (event, data) => callback(data));
  },

  // Clean up event listeners
  removeAudioExtractionListeners: () => {
    ipcRenderer.removeAllListeners('audio-extraction-progress');
    ipcRenderer.removeAllListeners('audio-extraction-status');
  }
});
