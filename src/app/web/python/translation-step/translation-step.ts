import { CommonModule } from '@angular/common';
import { Component, Input, Output, EventEmitter, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SharedService } from '../../../core/shared.service';

interface TranscriptionSegment {
  text: string;
  start?: number;
  end?: number;
  id?: string;
}

@Component({
  selector: 'app-translation-step',
  imports: [CommonModule, FormsModule],
  templateUrl: './translation-step.html',
  styleUrl: './translation-step.css'
})
export class TranslationStep implements OnInit, OnDestroy {
  @Input() correctedTextPath: string = '';
  @Output() translationCompleted = new EventEmitter<{ result: string; success: boolean }>();

  public readonly sharedService = inject(SharedService);
  // Data signals
  segments = signal<TranscriptionSegment[]>([]);
  statusMessage = signal<string>('');
  hasError = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  // Translation settings
  sourceLanguage = signal<string>('he');
  targetLanguage = signal<string>('en');
  translationService = signal<string>('openai');
  apiKey = signal<string>('');
  systemPrompt = signal<string>('You are a professional translator. Translate the text naturally while preserving the original meaning and context.');
  model = signal<string>('gpt-4');

  // Processing state
  isProcessing = signal<boolean>(false);
  progress = signal<number>(0);
  translationPath = signal<string>('');

  // UI state
  apiKeyVisible = false;

  // Computed properties
  hasInputFile = computed(() => !!this.correctedTextPath);
  hasSegments = computed(() => this.segments().length > 0);
  totalSegments = computed(() => this.segments().length);

  ngOnInit(): void {
    if (window.electron) {
      // Set up translation status listener - FIXED: Use translation instead of transcription
      window.electron.onTranslationStatus((data) => {
        this.handleTranslationStatus(data);
      });

      // Load the file when component initializes - FIXED: Added this
      if (this.hasInputFile()) {
        this.loadJsonFile();
      }
      const projectName: string | null = this.sharedService.get('projectName');
      if (projectName) {
        this.loadProjectDataJson(projectName);
      }
    } else {
      console.warn('Electron API not available. Running in a non-Electron environment.');
    }
  }

  ngOnDestroy(): void {
    if (window.electron) {
      // FIXED: Uncommented this essential cleanup
      window.electron.removeTranslationListeners();
    }
  }

  async loadProjectDataJson(projectName: string) {
    try {
      const appPathResult = await window.electron.getAppPath();
      const filePath = appPathResult.path + "/openAI.json";
      const json = await window.electron.readJsonFile(filePath || '');
      if (json.success) {
        this.apiKey.set(json.data['openAI-key'] || '');
        this.systemPrompt.set(json.data['openAI-prompt'] || '');
      }
    } catch (err) {
      console.error('❌ Failed to get project path:', err);
    }
  }

  private handleTranslationStatus(data: any) {
    console.log('Translation status:', data);

    switch (data.status) {
      case 'info':
        this.statusMessage.set(data.message);
        this.hasError.set(false);
        break;

      case 'progress':
        this.statusMessage.set(data.message);
        if (data.percent !== undefined) {
          this.progress.set(data.percent);
        }
        this.hasError.set(false);
        break;

      case 'success':
        this.statusMessage.set(data.message);
        this.progress.set(100);
        this.hasError.set(false);
        break;

      case 'error':
        this.showError(data.message);
        this.progress.set(0);
        break;

      case 'warning':
        this.statusMessage.set(`⚠️ ${data.message}`);
        this.hasError.set(false);
        break;

      default:
        console.log('Unknown translation status:', data);
    }
  }

  async loadJsonFile() {
    if (!this.correctedTextPath) {
      this.statusMessage.set('No corrected text file path provided.');
      return;
    }

    this.isLoading.set(true);
    this.statusMessage.set('Loading corrected text file...');
    this.hasError.set(false);

    try {
      if (!window.electron || !window.electron.readJsonFile) {
        throw new Error('Electron API for reading JSON is not available.');
      }

      const result = await window.electron.readJsonFile(this.correctedTextPath);

      if (result.success) {
        const segments = Array.isArray(result.data) ? result.data : [];

        // Add IDs to segments if they don't exist
        const segmentsWithIds = segments.map((segment, index) => ({
          ...segment,
          id: segment.id || `segment_${index}`
        }));

        this.segments.set(segmentsWithIds);
        this.statusMessage.set(`✅ Loaded ${segments.length} text segments from corrected file`);
        this.hasError.set(false);

      } else {
        this.showError(result.error || 'Failed to load corrected text file');
      }
    } catch (error: any) {
      this.showError(`Failed to read corrected text file: ${error.message || error}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  private showError(message: string) {
    this.statusMessage.set(message);
    this.hasError.set(true);
  }

  getDisplayPath(path: string): string {
    if (!path) return '';
    if (path.startsWith('projects/')) {
      return path;
    }
    return path;
  }

  getFileName(path: string): string {
    if (!path) return '';
    return path.split(/[\\/]/).pop() || '';
  }

  async startTranslation() {
    if (!this.hasSegments()) {
      this.showError('No text segments available for translation');
      return;
    }

    if (!this.apiKey().trim()) {
      this.showError('API key is required for translation');
      return;
    }

    this.isProcessing.set(true);
    this.progress.set(0);
    this.hasError.set(false);
    this.statusMessage.set('Starting translation...');

    try {
      // Generate output path
       const projectName: string | null = this.sharedService.get('projectName');
      if (!projectName) {
        console.warn('No project name set in SharedService');
      }
      const outputPath = (await window.electron.getProjectPath(projectName!)).path + "/segments.json";

      const result = await window.electron.runTranslation({
        inputPath: this.correctedTextPath,
        outputPath: outputPath,
        apiKey: this.apiKey(),
        systemPrompt: this.systemPrompt(),
        sourceLanguage: this.sourceLanguage(),
        targetLanguage: this.targetLanguage(),
        model: this.model()
      });

      if (result.success) {
        this.progress.set(100);
        this.statusMessage.set('✅ Translation completed successfully!');
        this.translationPath.set(outputPath);

        // Emit completion event
        this.translationCompleted.emit({
          result: outputPath,
          success: true
        });
      } else {
        this.showError(result.error || 'Translation failed');
        this.translationCompleted.emit({
          result: '',
          success: false
        });
      }
    } catch (error: any) {
      this.showError(`Translation error: ${error.message || error}`);
      this.translationCompleted.emit({
        result: '',
        success: false
      });
    } finally {
      this.isProcessing.set(false);
    }
  }
}