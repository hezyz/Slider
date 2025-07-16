import { CommonModule } from '@angular/common';
import { Component, signal, computed, inject, OnInit, OnDestroy, output } from '@angular/core';
import { SharedService } from '../../../core/shared.service';

@Component({
  selector: 'app-video-extract-step',
  imports: [CommonModule],
  templateUrl: './video-extract-step.html',
  styleUrl: './video-extract-step.css'
})
export class VideoExtractStep implements OnInit, OnDestroy {
  private sharedService = inject(SharedService);

  // Signals
  videoPath = signal<string>('');
  originalVideoPath = signal<string>('');
  outputPath = signal<string>('');
  isImporting = signal<boolean>(false);
  isProcessing = signal<boolean>(false);
  progress = signal<number>(0);
  statusMessage = signal<string>('');
  hasError = signal<boolean>(false);
  dependencies = signal<{ python: boolean; ffmpeg: boolean; ready: boolean }>({ 
    python: false, 
    ffmpeg: false, 
    ready: false 
  });
  isCheckingDeps = signal<boolean>(false);

  // Outputs
  videoLoaded = output<{ videoPath: string }>();
  audioExtracted = output<{ audioPath: string; success: boolean }>();

  // Computed properties
  projectName = computed(() => this.sharedService.projectName());
  hasProject = computed(() => !!this.projectName());
  
  canExtract = computed(() => 
    this.dependencies().ready &&
    this.hasProject() &&
    this.videoPath().trim() !== '' && 
    this.outputPath().trim() !== '' && 
    !this.isProcessing() &&
    !this.isImporting()
  );
  
  statusClass = computed(() => {
    if (this.hasError()) return 'danger';
    if (this.statusMessage().includes('successfully')) return 'success';
    return 'primary';
  });

  async ngOnInit() {
    // Check dependencies first
    await this.checkDependencies();
    
    // Set up progress listeners
    window.electron.onAudioExtractionProgress((data) => {
      this.progress.set(data.percent);
    });

    window.electron.onAudioExtractionStatus((data) => {
      this.statusMessage.set(data.message);
      this.hasError.set(data.status === 'error');
    });

    // Set output path when project changes
    this.updateOutputPath();
  }

  ngOnDestroy() {
    // Clean up event listeners
    window.electron.removeAudioExtractionListeners();
  }

  private updateOutputPath() {
    const project = this.projectName();
    if (project) {
      this.outputPath.set(`projects/${project}/files/audio.wav`);
    }
  }

  async checkDependencies() {
    this.isCheckingDeps.set(true);
    this.statusMessage.set('Checking dependencies...');

    try {
      const deps = await window.electron.checkPythonDependencies();
      this.dependencies.set(deps);
      
      if (!deps.ready) {
        this.statusMessage.set('Please install required dependencies');
      } else {
        this.statusMessage.set('All dependencies are ready!');
      }
    } catch (error) {
      this.statusMessage.set('Failed to check dependencies');
    } finally {
      this.isCheckingDeps.set(false);
    }
  }

  async selectVideo() {
    if (!this.hasProject()) {
      this.showError('Please create or open a project first');
      return;
    }

    try {
      const filePath = await window.electron.selectVideoFile();
      if (filePath) {
        this.originalVideoPath.set(filePath);
        this.statusMessage.set('Copying video to project folder...');
        this.hasError.set(false);
        this.isImporting.set(true);
        
        // Copy video to project files folder
        const result = await window.electron.copyVideoToProject({
          sourcePath: filePath,
          projectName: this.projectName()!
        });

        if (result.success && result.destinationPath) {
          this.videoPath.set(result.destinationPath);
          this.statusMessage.set('✅ Video loaded successfully!');
          this.hasError.set(false);
          
          // Emit video loaded event
          this.videoLoaded.emit({ videoPath: result.destinationPath });
        } else {
          this.showError(result.error || 'Failed to copy video');
        }
      }
    } catch (error) {
      this.showError('Failed to select or import video file');
    } finally {
      this.isImporting.set(false);
    }
  }

  async extractAudio() {
    if (!this.canExtract()) {
      this.showError('Cannot start extraction. Please check requirements.');
      return;
    }

    this.isProcessing.set(true);
    this.progress.set(0);
    this.statusMessage.set('Starting audio extraction...');
    this.hasError.set(false);

    try {
      const result = await window.electron.runAudioExtraction(
        this.videoPath(),
        this.outputPath()
      );

      if (result.success) {
        this.progress.set(100);
        this.statusMessage.set('✅ Audio extracted successfully!');
        this.hasError.set(false);
        
        // Emit success event
        this.audioExtracted.emit({
          audioPath: this.outputPath(),
          success: true
        });
      } else {
        this.showError(result.error || 'Unknown error occurred');
        this.audioExtracted.emit({
          audioPath: '',
          success: false
        });
      }
    } catch (error: any) {
      this.showError(`Error: ${error}`);
      this.audioExtracted.emit({
        audioPath: '',
        success: false
      });
    } finally {
      this.isProcessing.set(false);
    }
  }

  clearVideo() {
    this.originalVideoPath.set('');
    this.videoPath.set('');
    this.progress.set(0);
    this.statusMessage.set('');
    this.hasError.set(false);
  }

  private showError(message: string) {
    this.statusMessage.set(message);
    this.hasError.set(true);
    this.progress.set(0);
  }

  getFileName(path: string): string {
    if (!path) return '';
    return path.split(/[\\/]/).pop() || '';
  }

  getDisplayPath(path: string): string {
    if (!path) return '';
    if (path.startsWith('projects/')) {
      return path;
    }
    return path;
  }
}