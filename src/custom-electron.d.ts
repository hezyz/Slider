export { };

declare global {
  interface Window {
    electron: {
      createProject(projectName: string): Promise<{ success: boolean; path?: string; error?: string }>;
      selectJsonFile: () => Promise<{ canceled: boolean; filePath?: string }>;
      readJsonFile: (filePath: string) => Promise<{success: boolean;data?: any;error?: string;}>;
      selectFolder: () => Promise<string[]>;
    };
  }
}

