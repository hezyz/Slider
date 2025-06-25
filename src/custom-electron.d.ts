export { };

declare global {
  interface Window {
    electron: {
      createProject(projectName: string): Promise<{ success: boolean; path?: string; error?: string }>;
      selectJsonFile: () => Promise<{ canceled: boolean; filePath?: string }>;
      readJsonFile: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string; }>;
      importImages(projectName: string): Promise<{ success: boolean; images?: string[]; error?: string }>;
      getProjectImages: (projectName: string) => Promise<{ success: boolean; files?: string[]; error?: string; }>;
      selectFolder: () => Promise<string[]>;
    };
  }
}

