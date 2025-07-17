import { CommonModule } from '@angular/common';
import { Component, signal, computed, input, OnInit, OnDestroy, output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-transcription-step',
  imports: [CommonModule, FormsModule],
  templateUrl: './transcription-step.html',
  styleUrl: './transcription-step.css'
})
export class TranscriptionStep implements OnInit, OnDestroy {
  // Input
  audioPath = input.required<string>();

  // Signals
  isTranscribing = signal<boolean>(false);
  progress = signal<number>(0);
  statusMessage = signal<string>('');
  hasError = signal<boolean>(false);
  transcriptionResult = signal<string>('');
  isApplyingCorrections = signal<boolean>(false); // Added for corrections button
  
  // Transcription settings
  language = signal<string>('he');
  modelSize = signal<string>('medium');

  // Output
  transcriptionCompleted = output<{ result: string; success: boolean }>();

  // Model and language options
  modelOptions = [
    { value: 'tiny', label: 'Tiny (Fastest, Less Accurate)' },
    { value: 'base', label: 'Base (Fast, Good Accuracy)' },
    { value: 'small', label: 'Small (Medium Speed, Better Accuracy)' },
    { value: 'medium', label: 'Medium (Recommended)' },
    { value: 'large', label: 'Large (Slowest, Best Accuracy)' }
  ];
  
  languageOptions = [
    { value: 'he', label: 'Hebrew' },
    { value: 'en', label: 'English' },
    { value: 'auto', label: 'Auto-detect' }
  ];

  // Computed properties
  canTranscribe = computed(() => 
    !!this.audioPath() && 
    !this.isTranscribing()
  );
  
  statusClass = computed(() => {
    if (this.hasError()) return 'danger';
    if (this.statusMessage().includes('successfully')) return 'success';
    return 'primary';
  });

  estimatedTime = computed(() => {
    const modelMultipliers: Record<string, number> = {
      'tiny': 0.1,
      'base': 0.15,
      'small': 0.25,
      'medium': 0.5,
      'large': 1.0
    };
    
    const multiplier = modelMultipliers[this.modelSize()] || 0.5;
    // Assuming a base time of 10 minutes for 'large' model, adjust as needed
    return Math.ceil(10 * multiplier); 
  });

  ngOnInit() {
    // Ensure window.electron exists before trying to access its properties
    if (window.electron) {
      window.electron.onTranscriptionProgress((data) => {
        this.progress.set(data.percent);
      });

      window.electron.onTranscriptionStatus((data) => {
        this.statusMessage.set(data.message);
        this.hasError.set(data.status === 'error');
      });
    } else {
      console.warn('Electron API not available. Running in a non-Electron environment.');
      // Mock data for development if not in Electron
      // setTimeout(() => {
      //   this.progress.set(25);
      //   this.statusMessage.set('Processing audio...');
      // }, 1000);
      // setTimeout(() => {
      //   this.progress.set(75);
      //   this.statusMessage.set('Applying model...');
      // }, 3000);
      // setTimeout(() => {
      //   this.progress.set(100);
      //   this.statusMessage.set('✅ Transcription completed successfully!');
      //   this.transcriptionResult.set('Transcription saved to: mock_output.json');
      //   this.isTranscribing.set(false);
      //   this.transcriptionCompleted.emit({ result: 'mock_output.json', success: true });
      // }, 5000);
    }
  }

  ngOnDestroy() {
    if (window.electron) {
      window.electron.removeTranscriptionListeners();
    }
  }

  async startTranscription() {
    if (!this.canTranscribe()) {
      this.showError('Cannot start transcription. Check requirements.');
      return;
    }

    this.isTranscribing.set(true);
    this.progress.set(0);
    this.statusMessage.set('Starting transcription...');
    this.hasError.set(false);
    this.transcriptionResult.set('');

    try {
      // Ensure window.electron exists before calling its methods
      if (!window.electron || !window.electron.runTranscription) {
        throw new Error('Electron API for transcription is not available.');
      }

      const outputPath = this.audioPath().replace('.wav', '_segments.json');

      const result = await window.electron.runTranscription({
        audioPath: this.audioPath(),
        outputPath: outputPath,
        language: this.language(),
        modelSize: this.modelSize()
      });

      if (result.success) {
        this.progress.set(100);
        this.statusMessage.set('✅ Transcription completed successfully!');
        this.hasError.set(false);
        this.transcriptionResult.set('Transcription saved to: ' + outputPath);
        
        this.transcriptionCompleted.emit({
          result: outputPath,
          success: true
        });
      } else {
        this.showError(result.error || 'Unknown transcription error occurred');
        this.transcriptionCompleted.emit({
          result: '',
          success: false
        });
      }
    } catch (error: any) {
      this.showError(`Error: ${error.message || error}`);
      this.transcriptionCompleted.emit({
        result: '',
        success: false
      });
    } finally {
      this.isTranscribing.set(false);
    }
  }

  // Placeholder for applying corrections - implement actual logic here
  async applyCorrectionsToFile() {
    this.isApplyingCorrections.set(true);
    this.statusMessage.set('Applying corrections...');
    this.hasError.set(false);

    try {
      // Simulate an async operation
      await new Promise(resolve => setTimeout(resolve, 1500)); 
      
      // Here you would typically send the current transcription result
      // and any user-made corrections to your Electron backend
      // for processing and saving to the file.
      // Example: await window.electron.applyTranscriptionCorrections(this.transcriptionResult());

      this.statusMessage.set('Corrections applied successfully!');
      // You might want to re-emit transcriptionCompleted or another event if the file changes
    } catch (error: any) {
      this.showError(`Failed to apply corrections: ${error.message || error}`);
    } finally {
      this.isApplyingCorrections.set(false);
    }
  }

  private showError(message: string) {
    this.statusMessage.set(message);
    this.hasError.set(true);
    // Reset progress on error if it's not a completion progress
    if (!this.statusMessage().includes('successfully')) {
      this.progress.set(0);
    }
  }

  getDisplayPath(path: string): string {
    if (!path) return '';
    // Example: if path is a full system path, you might want to show just the filename
    // if (path.includes('/')) {
    //   return path.substring(path.lastIndexOf('/') + 1);
    // }
    // For 'projects/' prefix, display as is, otherwise display full path
    if (path.startsWith('projects/')) {
      return path;
    }
    return path;
  }
}
