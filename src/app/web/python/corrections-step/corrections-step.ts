import { CommonModule } from '@angular/common';
import { Component, signal, computed, input, OnInit, OnDestroy, output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CorrectionsManager } from '../corrections-manager/corrections-manager';

interface TranscriptionSegment {
  text: string;
  start?: number;
  end?: number;
  id?: string;
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
  editingSegment = signal<number | null>(null);
  editingText = signal<string>('');
  isSavingSegment = signal<boolean>(false);
  showCorrectionsModal = signal<boolean>(false);

  // Current corrections from the manager
  currentCorrections = signal<{ [key: string]: string }>({});
  // All saved correction rules (including ones not found in current text)
  allCorrections = signal<{ [key: string]: string }>({});

  // Output
  correctionsCompleted = output<{ result: string; success: boolean }>();

  // Computed properties
  totalSegments = computed(() => this.segments().length);
  hasSegments = computed(() => this.segments().length > 0);
  isEditing = computed(() => this.editingSegment() !== null);

  statusClass = computed(() => {
    if (this.hasError()) return 'danger';
    if (this.statusMessage().includes('successfully')) return 'success';
    return 'primary';
  });

  // Get correction words for display (all saved rules)
  correctionWords = computed(() => {
    return Object.keys(this.allCorrections());
  });

  // Get correction words that apply to current text
  applicableCorrections = computed(() => {
    return Object.keys(this.currentCorrections());
  });

  // Helper method to check if a segment is being edited
  isSegmentBeingEdited(segmentId: string): boolean {
    const editingIndex = this.editingSegment();
    if (editingIndex === null) return false;
    const editingSegment = this.segments()[editingIndex];
    return editingSegment?.id === segmentId;
  }

  // Helper method to get segment index by ID
  getSegmentIndexById(segmentId: string): number {
    return this.segments().findIndex(s => s.id === segmentId);
  }

  ngOnInit() {
    // Ensure window.electron exists before trying to access its properties
    if (window.electron) {
      // Set up corrections status listener
      window.electron.onCorrectionsStatus((data) => {
        this.statusMessage.set(data.message);
        this.hasError.set(data.status === 'error');
      });

      // Load the JSON file and correction rules
      this.loadJsonFile();
      this.loadAllCorrectionRules();
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
        // Add IDs to segments if they don't exist
        const segmentsWithIds = segments.map((segment, index) => ({
          ...segment,
          id: segment.id || `segment_${index}`
        }));
        
        this.segments.set(segmentsWithIds);
        this.filteredSegments.set(segmentsWithIds);
        this.statusMessage.set(`Loaded ${segments.length} text segments`);
        this.filterApplicableCorrections(); // Check which rules apply to loaded text
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
    this.allCorrections.set(corrections); // Update all corrections
    this.filterApplicableCorrections(); // Filter which ones apply to current text
    this.highlightCorrectableWords();
  }

  // Load all saved correction rules
  async loadAllCorrectionRules() {
    try {
      if (!window.electron || !window.electron.readJsonFile || !window.electron.getAppPath) {
        console.warn('Electron API not available.');
        return;
      }

      const appPathResult = await window.electron.getAppPath();
      const correctionFilePath = appPathResult.path + "/corrections.json";
      const result = await window.electron.readJsonFile(correctionFilePath);

      if (result.success && result.data) {
        this.allCorrections.set(result.data);
        this.filterApplicableCorrections();
      } else {
        // No corrections file found or empty, set empty object
        this.allCorrections.set({});
        this.currentCorrections.set({});
      }
    } catch (error: any) {
      console.warn(`Failed to load correction rules: ${error.message || error}`);
      this.allCorrections.set({});
      this.currentCorrections.set({});
    }
  }

  // Filter corrections that apply to current text
  filterApplicableCorrections() {
    const allCorrections = this.allCorrections();
    const applicableCorrections: { [key: string]: string } = {};
    
    // Check which correction words exist in the current segments
    Object.keys(allCorrections).forEach(word => {
      const hasWordInText = this.segments().some(segment => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        return regex.test(segment.text);
      });
      
      if (hasWordInText) {
        applicableCorrections[word] = allCorrections[word];
      }
    });

    this.currentCorrections.set(applicableCorrections);
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
      if (Object.keys(this.allCorrections()).length > 0) {
        this.statusMessage.set(`${Object.keys(this.allCorrections()).length} correction rules available, but none apply to current text`);
      } else {
        this.statusMessage.set('No correction rules defined');
      }
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

  // Edit segment functionality
  startEditSegment(index: number) {
    const segmentId = this.filteredSegments()[index].id;
    const actualIndex = this.getSegmentIndexById(segmentId!);
    
    this.editingSegment.set(actualIndex);
    this.editingText.set(this.segments()[actualIndex].text);
  }

  // Save segment edit immediately to file
  async saveSegmentEdit() {
    const editingIndex = this.editingSegment();
    if (editingIndex === null) return;

    this.isSavingSegment.set(true);
    this.statusMessage.set('Saving segment...');
    this.hasError.set(false);

    try {
      // Update the segment in memory
      const updatedSegments = [...this.segments()];
      updatedSegments[editingIndex] = {
        ...updatedSegments[editingIndex],
        text: this.editingText()
      };

      if (!window.electron || !window.electron.writeJsonFileByPath) {
        throw new Error('Electron API for saving JSON is not available.');
      }

      // Save immediately to file
      const result = await window.electron.writeJsonFileByPath(this.jsonFilePath(), updatedSegments);

      if (result.success) {
        // Update the segments state only after successful save
        this.segments.set(updatedSegments);
        this.filterSegments(); // Update filtered segments
        this.cancelEditSegment();
        this.statusMessage.set('✅ Segment saved successfully!');
        this.hasError.set(false);
      } else {
        this.showError(result.error || 'Failed to save segment');
      }
    } catch (error: any) {
      this.showError(`Error saving segment: ${error.message || error}`);
    } finally {
      this.isSavingSegment.set(false);
    }
  }

  cancelEditSegment() {
    this.editingSegment.set(null);
    this.editingText.set('');
  }

  onEditTextChange(text: string) {
    this.editingText.set(text);
  }

  // Modal control methods
  openCorrectionsModal() {
    this.showCorrectionsModal.set(true);
  }

  closeCorrectionsModal() {
    this.showCorrectionsModal.set(false);
    // Reload corrections when modal is closed to ensure we have the latest saved corrections
    this.loadAllCorrectionRules();
  }

  // Apply corrections to the JSON file
  async applyCorrections() {
    if (!this.jsonFilePath()) {
      this.showError('No file available to apply corrections to.');
      return;
    }

    const corrections = this.allCorrections(); // Use all corrections, not just applicable ones
    if (Object.keys(corrections).length === 0) {
      this.showError('No correction rules defined.');
      return;
    }

    this.isApplyingCorrections.set(true);
    this.statusMessage.set('Applying corrections to text...');
    this.hasError.set(false);

    try {
      // Apply corrections to segments locally
      const correctedSegments = this.segments().map(segment => {
        let correctedText = segment.text;
        
        // Apply each correction rule
        Object.keys(corrections).forEach(wrongWord => {
          const correctWord = corrections[wrongWord];
          // Use word boundaries to ensure only whole words are replaced
          const regex = new RegExp(`\\b${wrongWord}\\b`, 'g');
          correctedText = correctedText.replace(regex, correctWord);
        });

        return {
          ...segment,
          text: correctedText
        };
      });

      if (!window.electron || !window.electron.writeJsonFileByPath) {
        throw new Error('Electron API for saving JSON is not available.');
      }

      // Save the corrected segments to file
      const result = await window.electron.writeJsonFileByPath(this.jsonFilePath(), correctedSegments);

      if (result.success) {
        // Count how many segments were actually changed by comparing original with corrected
        const originalSegments = this.segments();
        const changedSegments = correctedSegments.filter((segment, index) => 
          segment.text !== originalSegments[index]?.text
        );

        // Update the segments in memory to reflect the changes
        this.segments.set(correctedSegments);
        this.filterSegments(); // Update filtered segments

        this.statusMessage.set(`✅ Corrections applied successfully! ${changedSegments.length} segments updated.`);
        this.hasError.set(false);

        // Re-filter applicable corrections since text has changed
        this.filterApplicableCorrections();

        // Emit success event
        this.correctionsCompleted.emit({
          result: this.jsonFilePath(),
          success: true
        });
      } else {
        this.showError(result.error || 'Failed to save corrected text');
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

  confirmApplyAll() {
  if (confirm(`Are you sure you want to apply all ${this.correctionWords().length} corrections to the text segments? This will overwrite existing text.`)) {
    this.applyCorrections();
  }
}
}