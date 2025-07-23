export { };

declare global {
  interface Window {
    electron: {
      // Project management methods
      createProject(projectName: string): Promise<{ success: boolean; path?: string; error?: string }>;
      selectJsonFile: () => Promise<{ canceled: boolean; filePath?: string }>;
      readJsonFile: (filePath: string) => Promise<{ success: boolean; data?: any; error?: string; }>;
      importImages(projectName: string): Promise<{ success: boolean; images?: string[]; error?: string }>;
      getProjectImages: (projectName: string) => Promise<{ success: boolean; files?: string[]; error?: string; }>;
      selectFolder: () => Promise<string[]>;
      copyFileAndCreateSegments: (data: {
        sourcePath: string;
        projectName: string;
      }) => Promise<{ success: boolean; message?: string; error?: string; targetFilePath?: string }>;
      writeJsonFile: (projectName: string, fileName: string, data: any) => Promise<{ success: boolean; path?: string; error?: string; }>;
      writeJsonFileByPath: (filePath: string, data: any) => Promise<{ success: boolean; path?: string; error?: string; }>;
      getProjectPath: (projectName: string) => Promise<{ success: boolean; path?: string; error?: string; }>;
      getAppPath: () => Promise<{ success: boolean; path?: string; error?: string; }>;

      // Video file selection and management methods
      selectVideoFile: () => Promise<string | null>;
      copyVideoToProject: (data: {
        sourcePath: string;
        projectName: string;
      }) => Promise<{
        success: boolean;
        destinationPath?: string;
        absolutePath?: string;
        fileName?: string;
        error?: string;
      }>;

      // Python dependency checking
      checkPythonDependencies: () => Promise<{
        python: boolean;
        ffmpeg: boolean;
        ready: boolean
      }>;

      // Audio extraction methods
      runAudioExtraction: (inputPath: string, outputPath: string) => Promise<{
        success: boolean;
        error?: string
      }>;
      onAudioExtractionProgress: (callback: (data: {
        type: string;
        percent: number
      }) => void) => void;
      onAudioExtractionStatus: (callback: (data: {
        type: string;
        status: 'info' | 'success' | 'error';
        message: string
      }) => void) => void;
      removeAudioExtractionListeners: () => void;

      // Transcription methods
      runTranscription: (params: {
        audioPath: string;
        outputPath: string;
        corrections?: string;
        language?: string;
        modelSize?: string;
      }) => Promise<{
        success: boolean;
        error?: string
      }>;
      onTranscriptionProgress: (callback: (data: {
        type: string;
        percent: number;
        message?: string;
      }) => void) => void;
      onTranscriptionStatus: (callback: (data: {
        type: string;
        status: 'info' | 'success' | 'error' | 'warning';
        message: string
      }) => void) => void;
      removeTranscriptionListeners: () => void;

      // Corrections methods
      applyCorrections: (params: {
        jsonFilePath: string;
        corrections: { [key: string]: string };
        outputPath?: string;
      }) => Promise<{
        success: boolean;
        error?: string
      }>;
      onCorrectionsStatus: (callback: (data: {
        type: string;
        status: 'info' | 'success' | 'error';
        message: string
      }) => void) => void;

      // NEW: Translation methods
      runTranslation: (params: {
        inputPath: string;
        outputPath: string;
        apiKey: string;
        systemPrompt: string;
        sourceLanguage?: string;
        targetLanguage?: string;
        model?: string;
      }) => Promise<{
        success: boolean;
        error?: string
      }>;
      onTranslationStatus: (callback: (data: {
        type: string;
        status: 'info' | 'success' | 'error' | 'warning' | 'progress';
        message: string;
        percent?: number;
      }) => void) => void;
      removeTranslationListeners: () => void;

      // Python environment setup methods
      setupLocalPython: () => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
      testLocalPython: () => Promise<{
        success: boolean;
        message?: string;
        error?: string;
      }>;
      debugPythonEnvironment: () => Promise<{
        success: boolean;
        details?: any;
        error?: string;
      }>;

      // Cleanup methods
      removeAllAudioListeners: () => void;
    };
  }
}