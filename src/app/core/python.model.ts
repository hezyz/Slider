export interface DependencyStatus {
  python: boolean;
  ffmpeg: boolean;
  ready: boolean;
}

export interface StatusData {
  type: string;
  status: 'info' | 'success' | 'error';
  message: string;
}