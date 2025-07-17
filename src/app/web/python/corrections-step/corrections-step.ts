import { CommonModule } from '@angular/common';
import { Component, signal, computed, input, OnInit, OnDestroy, output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CorrectionsManager } from '../corrections-manager/corrections-manager';

interface TranscriptionSegment {
  text: string;
  start?: number;
  end?: number;
}

@Component({
  selector: 'app-corrections-step',
  imports: [CommonModule, FormsModule, CorrectionsManager],
  templateUrl: './corrections-step.html',
  styleUrl: './corrections-step.css'
})
export class CorrectionsStep implements OnInit, OnDestroy {
  // ViewChild to access the corrections manager
  @ViewChild(CorrectionsManager) correctionsManager!: CorrectionsManager;

  // Input
  jsonFilePath = input.required<string>();

  // Signals
  isLoading = signal<boolean>(false);
  isApplyingCorrections = signal<boolean>(false);
  statusMessage = signal<string>('');
  hasError = signal<boolean>(false);
  segments = signal<TranscriptionSegment[]>([]);
  filteredSegments = signal<TranscriptionSegment[]>([]);
  searchTerm = signal<string>('');

  // Current corrections from the manager
  currentCorrections = signal<{ [key: string]: string }>({});

  // Output
  correctionsCompleted = output<{ result: string; success: boolean }>();

  // Computed properties
  totalSegments = computed(() => this.segments().length);
  hasSegments = computed(() => this.segments().length > 0);

  statusClass = computed(() => {
    if (this.hasError()) return 'danger';
    if (this.statusMessage().includes('successfully')) return 'success';
    return 'primary';
  });

  // Get correction words for display
  correctionWords = computed(() => {
    return Object.keys(this.currentCorrections());
  });

  ngOnInit() {
    // Ensure window.electron exists before trying to access its properties
    if (window.electron) {
      // Set up corrections status listener
      window.electron.onCorrectionsStatus((data) => {
        this.statusMessage.set(data.message);
        this.hasError.set(data.status === 'error');
      });

      // Load the JSON file
      this.loadJsonFile();
    } else {
      console.warn('Electron API not available. Running in a non-Electron environment.');
    }
  }

  ngOnDestroy() {
    // Clean up listeners
    if (window.electron) {
      window.electron.removeTranscriptionListeners();
    }
  }

  async loadJsonFile() {
    if (!this.jsonFilePath()) {
      this.statusMessage.set('No JSON file path provided.');
      return;
    }

    this.isLoading.set(true);
    this.statusMessage.set('Loading transcription file...');
    this.hasError.set(false);

    try {
      if (!window.electron || !window.electron.readJsonFile) {
        throw new Error('Electron API for reading JSON is not available.');
      }
      const result = await window.electron.readJsonFile(this.jsonFilePath());

      if (result.success) {
        const segments = Array.isArray(result.data) ? result.data : [];
        this.segments.set(segments);
        this.filteredSegments.set(segments);
        this.statusMessage.set(`Loaded ${segments.length} text segments`);
        this.highlightCorrectableWords();
      } else {
        this.showError(result.error || 'Failed to load JSON file');
      }
    } catch (error: any) {
      this.showError(`Failed to read transcription file: ${error.message || error}`);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Filter segments based on search term
  filterSegments() {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      this.filteredSegments.set(this.segments());
      return;
    }

    const filtered = this.segments().filter(segment =>
      segment.text.toLowerCase().includes(term)
    );
    this.filteredSegments.set(filtered);
  }

  // Handle corrections changes from the manager component
  onCorrectionsChanged(corrections: { [key: string]: string }) {
    this.currentCorrections.set(corrections);
    this.highlightCorrectableWords();
  }

  // Handle status updates from the manager component
  onCorrectionsStatusUpdate(status: { message: string; hasError: boolean }) {
    this.statusMessage.set(status.message);
    this.hasError.set(status.hasError);
  }

  // Highlight words that will be corrected
  highlightCorrectableWords() {
    const corrections = this.currentCorrections();
    const correctionKeys = Object.keys(corrections);

    if (correctionKeys.length === 0) {
      this.statusMessage.set('No correction rules defined');
      return;
    }

    let foundCount = 0;
    this.segments().forEach(segment => {
      correctionKeys.forEach(key => {
        // Use a regex with word boundaries to match whole words for highlighting accuracy
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        if (regex.test(segment.text)) {
          foundCount++;
        }
      });
    });

    if (foundCount > 0) {
      this.statusMessage.set(`Found ${foundCount} segments containing correctable words`);
    } else {
      this.statusMessage.set('No correctable words found in segments with current rules.');
    }
  }

  // Apply corrections to the JSON file
  async applyCorrections() {
    if (!this.jsonFilePath()) {
      this.showError('No file available to apply corrections to.');
      return;
    }

    const corrections = this.currentCorrections();
    if (Object.keys(corrections).length === 0) {
      this.showError('No correction rules defined.');
      return;
    }

    this.isApplyingCorrections.set(true);
    this.statusMessage.set('Applying corrections to text...');
    this.hasError.set(false);

    try {
      if (!window.electron || !window.electron.applyCorrections) {
        throw new Error('Electron API for applying corrections is not available.');
      }
      
      const result = await window.electron.applyCorrections({
        jsonFilePath: this.jsonFilePath(),
        corrections: JSON.stringify(corrections)
      });

      if (result.success) {
        this.statusMessage.set('✅ Corrections applied successfully!');
        this.hasError.set(false);

        // Reload the file to show updated text immediately after applying corrections
        await this.loadJsonFile();

        // Emit success event
        this.correctionsCompleted.emit({
          result: this.jsonFilePath(),
          success: true
        });
      } else {
        this.showError(result.error || 'Failed to apply corrections');
      }
    } catch (error: any) {
      this.showError(`Error applying corrections: ${error.message || error}`);
    } finally {
      this.isApplyingCorrections.set(false);
    }
  }

  // Highlight correctable words in text for display
  highlightText(text: string): string {
    const corrections = this.currentCorrections();
    let highlightedText = text;

    Object.keys(corrections).forEach(key => {
      // Use word boundaries (\b) to ensure only whole words are matched
      const regex = new RegExp(`\\b${key}\\b`, 'gi');
      // Highlight the original word that will be corrected
      highlightedText = highlightedText.replace(regex, '<mark class="bg-warning">$&</mark>');
    });

    return highlightedText;
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
}