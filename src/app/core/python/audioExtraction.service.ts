import { Injectable, signal, computed } from '@angular/core';

export interface ExtractionJob {
  id: string;
  inputPath: string;
  outputPath: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
}

export interface DependencyStatus {
  python: boolean;
  ffmpeg: boolean;
  ready: boolean;
  lastChecked: number;
}

@Injectable({
  providedIn: 'root'
})
export class AudioExtractionService {
  // Signals for reactive state management
  private _dependencies = signal<DependencyStatus>({
    python: false,
    ffmpeg: false,
    ready: false,
    lastChecked: 0
  });

  private _jobs = signal<ExtractionJob[]>([]);
  private _currentJob = signal<ExtractionJob | null>(null);
  private _isInitialized = signal<boolean>(false);

  // Public computed properties
  dependencies = computed(() => this._dependencies());
  jobs = computed(() => this._jobs());
  currentJob = computed(() => this._currentJob());
  isInitialized = computed(() => this._isInitialized());
  isProcessing = computed(() => this._currentJob()?.status === 'running');
  
  // Statistics
  completedJobs = computed(() => this._jobs().filter(job => job.status === 'completed'));
  failedJobs = computed(() => this._jobs().filter(job => job.status === 'failed'));
  
  async initialize() {
    if (this._isInitialized()) return;

    try {
      await this.checkDependencies();
      this.setupEventListeners();
      this._isInitialized.set(true);
    } catch (error) {
      console.error('Failed to initialize AudioExtractionService:', error);
      throw error;
    }
  }

  async checkDependencies(force: boolean = false): Promise<DependencyStatus> {
    const current = this._dependencies();
    const now = Date.now();
    
    // Check cache (5 minutes)
    if (!force && current.lastChecked && (now - current.lastChecked) < 300000) {
      return current;
    }

    try {
      const deps = await window.electron.checkPythonDependencies();
      const updated: DependencyStatus = {
        ...deps,
        lastChecked: now
      };
      
      this._dependencies.set(updated);
      return updated;
    } catch (error) {
      console.error('Failed to check dependencies:', error);
      throw error;
    }
  }

  async startExtraction(inputPath: string, outputPath: string): Promise<string> {
    if (!this._dependencies().ready) {
      throw new Error('Dependencies not ready');
    }

    if (this.isProcessing()) {
      throw new Error('Another extraction is already running');
    }

    const jobId = this.generateJobId();
    const job: ExtractionJob = {
      id: jobId,
      inputPath,
      outputPath,
      status: 'pending',
      progress: 0,
      startTime: Date.now()
    };

    this._currentJob.set(job);
    this.addJob(job);

    try {
      // Update job status
      this.updateCurrentJob({ status: 'running' });

      const result = await window.electron.runAudioExtraction(inputPath, outputPath);

      if (result.success) {
        this.updateCurrentJob({ 
          status: 'completed', 
          progress: 100, 
          endTime: Date.now() 
        });
      } else {
        this.updateCurrentJob({ 
          status: 'failed', 
          error: result.error || 'Unknown error',
          endTime: Date.now() 
        });
        throw new Error(result.error || 'Extraction failed');
      }

      return jobId;
    } catch (error) {
      this.updateCurrentJob({ 
        status: 'failed', 
        error: error instanceof Error ? error.message : 'Unknown error',
        endTime: Date.now() 
      });
      throw error;
    } finally {
      // Clear current job after a delay
      setTimeout(() => {
        this._currentJob.set(null);
      }, 2000);
    }
  }

  cancelCurrentExtraction() {
    const current = this._currentJob();
    if (current && current.status === 'running') {
      // Note: You might want to implement actual cancellation in the Python script
      this.updateCurrentJob({ 
        status: 'failed', 
        error: 'Cancelled by user',
        endTime: Date.now() 
      });
      this._currentJob.set(null);
    }
  }

  getJobById(jobId: string): ExtractionJob | undefined {
    return this._jobs().find(job => job.id === jobId);
  }

  clearCompletedJobs() {
    const jobs = this._jobs().filter(job => job.status !== 'completed');
    this._jobs.set(jobs);
  }

  clearFailedJobs() {
    const jobs = this._jobs().filter(job => job.status !== 'failed');
    this._jobs.set(jobs);
  }

  private setupEventListeners() {
    window.electron.onAudioExtractionProgress((data) => {
      this.updateCurrentJob({ progress: data.percent });
    });

    window.electron.onAudioExtractionStatus((data) => {
      // Handle status updates if needed
      console.log('Status update:', data);
    });
  }

  private updateCurrentJob(updates: Partial<ExtractionJob>) {
    const current = this._currentJob();
    if (!current) return;

    const updated = { ...current, ...updates };
    this._currentJob.set(updated);
    
    // Also update in jobs array
    this.updateJobInArray(updated);
  }

  private addJob(job: ExtractionJob) {
    const jobs = [...this._jobs(), job];
    this._jobs.set(jobs);
  }

  private updateJobInArray(updatedJob: ExtractionJob) {
    const jobs = this._jobs().map(job => 
      job.id === updatedJob.id ? updatedJob : job
    );
    this._jobs.set(jobs);
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  destroy() {
    window.electron.removeAudioExtractionListeners();
    this._isInitialized.set(false);
  }
}