import { CommonModule } from '@angular/common';
import { Component, computed, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DependencyStatus, StatusData } from '../../../core/python.model';

@Component({
  selector: 'app-audio-processor',
  imports: [FormsModule, CommonModule],
  templateUrl: './audio-processor.html',
  styleUrl: './audio-processor.css'
})
export class AudioProcessor implements OnInit, OnDestroy {
  // Signals for reactive state
  inputPath = signal<string>('');
  outputPath = signal<string>('');
  isProcessing = signal<boolean>(false);
  progress = signal<number>(0);
  statusMessage = signal<string>('');
  hasError = signal<boolean>(false);
  dependencies = signal<DependencyStatus>({ python: false, ffmpeg: false, ready: false });
  operationLog = signal<Array<{ timestamp: number, message: string, type: 'info' | 'success' | 'error' }>>([]);

  // Computed properties
  dependenciesReady = computed(() => this.dependencies().ready);
  canExtract = computed(() => 
    this.dependenciesReady() && 
    this.inputPath().trim() !== '' && 
    this.outputPath().trim() !== '' && 
    !this.isProcessing()
  );
  
  statusClass = computed(() => {
    if (this.hasError()) return 'error';
    if (this.statusMessage().includes('successfully')) return 'success';
    return 'info';
  });

  async ngOnInit() {
    // Check if Python and ffmpeg are available
    await this.checkDependencies();
    
    // Set up progress listeners
    window.electron.onAudioExtractionProgress((data) => {
      this.progress.set(data.percent);
    });

    window.electron.onAudioExtractionStatus((data: StatusData) => {
      this.statusMessage.set(data.message);
      this.hasError.set(data.status === 'error');
      this.addLogEntry(data.message, data.status);
    });
  }

  ngOnDestroy() {
    // Clean up event listeners
    window.electron.removeAudioExtractionListeners();
  }

  async checkDependencies() {
    try {
      const deps = await window.electron.checkPythonDependencies();
      this.dependencies.set(deps);
      
      if (!deps.python) {
        this.showError('Python is not installed or not in PATH');
      } else if (!deps.ffmpeg) {
        this.showError('ffmpeg is not installed or not in PATH');
      } else {
        this.statusMessage.set('Dependencies are ready!');
        this.hasError.set(false);
        this.addLogEntry('Dependencies checked successfully', 'success');
      }
    } catch (error) {
      this.showError('Failed to check dependencies');
      this.addLogEntry('Failed to check dependencies', 'error');
    }
  }

  async extractAudio() {
    if (!this.canExtract()) {
      this.showError('Cannot start extraction. Check dependencies and paths.');
      return;
    }

    this.isProcessing.set(true);
    this.progress.set(0);
    this.statusMessage.set('Starting audio extraction...');
    this.hasError.set(false);
    this.addLogEntry('Starting audio extraction', 'info');

    try {
      const result = await window.electron.runAudioExtraction(
        this.inputPath(), 
        this.outputPath()
      );

      if (result.success) {
        this.progress.set(100);
        this.statusMessage.set('✅ Audio extracted successfully!');
        this.hasError.set(false);
        this.addLogEntry('Audio extraction completed successfully', 'success');
      } else {
        this.showError(result.error || 'Unknown error occurred');
        this.addLogEntry(result.error || 'Unknown error occurred', 'error');
      }
    } catch (error: any) {
      this.showError(`Error: ${error}`);
      this.addLogEntry(`Error: ${error}`, 'error');
    } finally {
      this.isProcessing.set(false);
    }
  }

  private showError(message: string) {
    this.statusMessage.set(message);
    this.hasError.set(true);
    this.progress.set(0);
  }

  private addLogEntry(message: string, type: 'info' | 'success' | 'error') {
    const currentLog = this.operationLog();
    const newEntry = {
      timestamp: Date.now(),
      message,
      type
    };
    
    // Keep only last 10 entries
    const updatedLog = [newEntry, ...currentLog].slice(0, 10);
    this.operationLog.set(updatedLog);
  }

  formatTimestamp(timestamp: number): string {
    return new Date(timestamp).toLocaleTimeString();
  }
}