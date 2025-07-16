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
  
  // Transcription settings
  language = signal<string>('he');
  modelSize = signal<string>('medium');
  corrections = signal<string>('{"OneOtra": "One no Trump", "OneOtrump": "One no Trump", "103": "One no Trump", "וOneSpring": "one Spade", "1 or Trump": "One no Trump", "באלפא":"בעל פה", "בריץ": "ברידג", "בכל אור":"בכל זאת", "דומה":"דומם"}');

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
    !this.isTranscribing() &&
    this.validateCorrections()
  );
  
  statusClass = computed(() => {
    if (this.hasError()) return 'danger';
    if (this.statusMessage().includes('successfully')) return 'success';
    return 'primary';
  });

  estimatedTime = computed(() => {
    const modelMultipliers = {
      'tiny': 0.1,
      'base': 0.15,
      'small': 0.25,
      'medium': 0.5,
      'large': 1.0
    };
    
    const multiplier = modelMultipliers[this.modelSize() as keyof typeof modelMultipliers] || 0.5;
    // Assume average 10 minute audio file
    return Math.ceil(10 * multiplier);
  });

  ngOnInit() {
    // Set up transcription progress listeners
    window.electron.onTranscriptionProgress((data) => {
      this.progress.set(data.percent);
    });

    window.electron.onTranscriptionStatus((data) => {
      this.statusMessage.set(data.message);
      this.hasError.set(data.status === 'error');
    });
  }

  ngOnDestroy() {
    // Clean up event listeners
    window.electron.removeTranscriptionListeners();
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
      // Prepare output path for segments
      const outputPath = this.audioPath().replace('.wav', '_segments.json');

      const result = await window.electron.runTranscription({
        audioPath: this.audioPath(),
        outputPath: outputPath,
        corrections: this.corrections().trim() || undefined,
        language: this.language(),
        modelSize: this.modelSize()
      });

      if (result.success) {
        this.progress.set(100);
        this.statusMessage.set('✅ Transcription completed successfully!');
        this.hasError.set(false);
        this.transcriptionResult.set('Transcription saved to: ' + outputPath);
        
        // Emit success event
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
      this.showError(`Error: ${error}`);
      this.transcriptionCompleted.emit({
        result: '',
        success: false
      });
    } finally {
      this.isTranscribing.set(false);
    }
  }

  validateCorrections(): boolean {
    const corrections = this.corrections().trim();
    if (!corrections) return true;
    
    try {
      JSON.parse(corrections);
      return true;
    } catch (e) {
      return false;
    }
  }

  formatCorrections() {
    try {
      const parsed = JSON.parse(this.corrections());
      this.corrections.set(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // Keep original if parsing fails
    }
  }

  clearCorrections() {
    this.corrections.set('');
  }

  loadDefaultCorrections() {
    const defaultCorrections = {
      "OneOtra": "One no Trump",
      "OneOtrump": "One no Trump", 
      "103": "One no Trump",
      "וOneSpring": "one Spade",
      "1 or Trump": "One no Trump",
      "באלפא": "בעל פה",
      "בריץ": "ברידג",
      "בכל אור": "בכל זאת",
      "דומה": "דומם"
    };
    this.corrections.set(JSON.stringify(defaultCorrections, null, 2));
  }

  private showError(message: string) {
    this.statusMessage.set(message);
    this.hasError.set(true);
    this.progress.set(0);
  }

  getDisplayPath(path: string): string {
    if (!path) return '';
    if (path.startsWith('projects/')) {
      return path;
    }
    return path;
  }
}