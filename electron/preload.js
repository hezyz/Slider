const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  // Existing project methods
  createProject: (name) => ipcRenderer.invoke('create-project', name),
  selectJsonFile: async () => { return await ipcRenderer.invoke('select-json-file'); },
  readJsonFile: async (filePath) => { return await ipcRenderer.invoke('read-json-file', filePath); },
  importImages: (projectName) => ipcRenderer.invoke('import-images', projectName),
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  getProjectImages: async (projectName) => { return await ipcRenderer.invoke('get-project-images', projectName); },
  copyFileAndCreateSegments: (data) => ipcRenderer.invoke('copy-file-and-create-segments', data),
  writeJsonFile: (projectName, fileName, data) => ipcRenderer.invoke('write-json-file', projectName, fileName, data),
  writeCorrectionsJsonFile: (filePath, data) => ipcRenderer.invoke('write-corrections-json-file', filePath, data),
  getProjectPath: (projectName) => ipcRenderer.invoke('get-project-path', projectName),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Python/Video processing methods
  selectVideoFile: () => ipcRenderer.invoke('select-video-file'),
  copyVideoToProject: (params) => ipcRenderer.invoke('copy-video-to-project', params),
  checkPythonDependencies: () => ipcRenderer.invoke('check-python-dependencies'),

  // Audio extraction methods
  runAudioExtraction: (inputPath, outputPath) => ipcRenderer.invoke('run-audio-extraction', { inputPath, outputPath }),
  onAudioExtractionProgress: (callback) => {
    ipcRenderer.on('audio-extraction-progress', (event, data) => callback(data));
  },
  onAudioExtractionStatus: (callback) => {
    ipcRenderer.on('audio-extraction-status', (event, data) => callback(data));
  },
  removeAudioExtractionListeners: () => {
    ipcRenderer.removeAllListeners('audio-extraction-progress');
    ipcRenderer.removeAllListeners('audio-extraction-status');
  },

  // Transcription methods
  runTranscription: (params) => ipcRenderer.invoke('run-transcription', params),
  applyCorrections: (params) => ipcRenderer.invoke('apply-corrections', params),
  onTranscriptionProgress: (callback) => {
    ipcRenderer.on('transcription-progress', (event, data) => callback(data));
  },
  onTranscriptionStatus: (callback) => {
    ipcRenderer.on('transcription-status', (event, data) => callback(data));
  },
  onCorrectionsStatus: (callback) => {
    ipcRenderer.on('corrections-status', (event, data) => callback(data));
  },
  removeTranscriptionListeners: () => {
    ipcRenderer.removeAllListeners('transcription-progress');
    ipcRenderer.removeAllListeners('transcription-status');
    ipcRenderer.removeAllListeners('corrections-status');
  },

  // Python environment setup methods
  setupLocalPython: () => ipcRenderer.invoke('setup-local-python'),
  testLocalPython: () => ipcRenderer.invoke('test-local-python'),
  debugPythonEnvironment: () => ipcRenderer.invoke('debug-python-environment'),

  // Clean up all listeners
  removeAllAudioListeners: () => {
    ipcRenderer.removeAllListeners('audio-extraction-progress');
    ipcRenderer.removeAllListeners('audio-extraction-status');
    ipcRenderer.removeAllListeners('transcription-progress');
    ipcRenderer.removeAllListeners('transcription-status');
  }
});