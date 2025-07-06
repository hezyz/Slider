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
});