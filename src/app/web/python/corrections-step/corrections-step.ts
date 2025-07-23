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

  // Outputs - ADD THE MISSING OUTPUT
  correctionsCompleted = output<{ result: string; success: boolean }>();

  allCorrections = signal<{ [key: string]: string }>({});
  // Get correction words for display (all saved rules)
  correctionWords = computed(() => {
    return Object.keys(this.allCorrections());
  });

  segments = signal<TranscriptionSegment[]>([]);
  filteredSegments = signal<TranscriptionSegment[]>([]);
  searchTerm = signal<string>('');
  showCorrectionsModal = signal<boolean>(false);
  statusMessage = signal<string>('');
  hasError = signal<boolean>(false);
  editingSegment = signal<number | null>(null);
  editingText = signal<string>('');
  isSavingSegment = signal<boolean>(false);

  isEditing = computed(() => this.editingSegment() !== null);

  ngOnDestroy(): void {
    // Clean up any listeners if needed
  }

  ngOnInit(): void {
    if (window.electron) {
      // Set up corrections status listener
      window.electron.onCorrectionsStatus((data) => {
        this.statusMessage.set(data.message);
        this.hasError.set(data.status === 'error');
      });
      this.loadJsonFile();
      this.loadAllCorrectionRules();
    } else {
      console.warn('Electron API not available. Running in a non-Electron environment.');
    }
  }

  /*============================================================================
    ===================== Segments file handling methods ===========================
    ============================================================================*/
  async loadJsonFile() {
    if (!this.jsonFilePath()) {
      this.statusMessage.set('No JSON file path provided.');
      return;
    }
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

      } else {
        this.showError(result.error || 'Failed to load JSON file');
      }
    } catch (error: any) {
      this.showError(`Failed to read transcription file: ${error.message || error}`);
    } finally {

    }
  }

  highlightText(text: string): string {
    const corrections = this.allCorrections();
    if (!corrections || Object.keys(corrections).length === 0) return text;

    // Lowercase correction lookup for case-insensitive matching
    const lowerCaseCorrections = Object.entries(corrections).reduce((acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    }, {} as { [key: string]: string });

    // Escape all words for regex
    const escapedWords = Object.keys(corrections)
      .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

    if (escapedWords.length === 0) return text;

    // Build regex without \b for Hebrew/Unicode safety
    const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');

    return text.replace(regex, (match) => {
      const correction = lowerCaseCorrections[match.toLowerCase()];
      return `
      <del class="text-danger" title="Incorrect">${match}</del>
      <span class="bg-success-subtle px-1 rounded ms-1" title="Correction: ${correction}">${correction}</span>
    `;
    });
  }

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

  isSegmentBeingEdited(segmentId: string): boolean {
    const editingIndex = this.editingSegment();
    if (editingIndex === null) return false;
    const editingSegment = this.segments()[editingIndex];
    return editingSegment?.id === segmentId;
  }

  startEditSegment(index: number) {
    const segmentId = this.filteredSegments()[index].id;
    const actualIndex = this.getSegmentIndexById(segmentId!);

    this.editingSegment.set(actualIndex);
    this.editingText.set(this.segments()[actualIndex].text);
  }

  getSegmentIndexById(segmentId: string): number {
    return this.segments().findIndex(s => s.id === segmentId);
  }

  cancelEditSegment() {
    this.editingSegment.set(null);
    this.editingText.set('');
  }

  onEditTextChange(text: string) {
    this.editingText.set(text);
  }

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

        // Emit completion event when edits are saved
        this.correctionsCompleted.emit({
          result: this.jsonFilePath(),
          success: true
        });
      } else {
        this.showError(result.error || 'Failed to save segment');
      }
    } catch (error: any) {
      this.showError(`Error saving segment: ${error.message || error}`);
    } finally {
      this.isSavingSegment.set(false);
    }
  }

  /*============================================================================
   ===================== Corrects file handling methods ===========================
   ============================================================================*/
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
      } else {
        this.allCorrections.set({});
      }
    } catch (error: any) {
      console.warn(`Failed to load correction rules: ${error.message || error}`);
      this.allCorrections.set({});
    }
  }

  /*============================================================================
    ===================== Modal control methods ================================
    ============================================================================*/
  openCorrectionsModal() {
    this.showCorrectionsModal.set(true);
  }

  closeCorrectionsModal() {
    this.showCorrectionsModal.set(false);
    // Reload corrections when modal is closed to ensure we have the latest saved corrections
    this.loadAllCorrectionRules();
  }

  onCorrectionsChanged(corrections: { [key: string]: string }) {
    this.allCorrections.set(corrections); // Update all corrections
    // this.highlightCorrectableWords();
  }

  onCorrectionsStatusUpdate(status: { message: string; hasError: boolean }) {
    this.statusMessage.set(status.message);
    this.hasError.set(status.hasError);
  }

  private showError(message: string) {
    this.statusMessage.set(message);
    this.hasError.set(true);
  }

  confirmApplyAll() {
    if (confirm(`Are you sure you want to apply all ${this.correctionWords().length} corrections to the text segments? This will overwrite existing text.`)) {
      this.applyCorrections();
    }
  }

  // ADD THE MISSING METHOD
  async applyCorrections() {
    if (this.correctionWords().length === 0) {
      this.showError('No correction rules defined');
      return;
    }

    this.statusMessage.set('Applying corrections to all segments...');
    this.hasError.set(false);

    try {
      const corrections = this.allCorrections();

      // Lowercase map for case-insensitive replacement
      const lowerCaseCorrections = Object.entries(corrections).reduce((acc, [key, value]) => {
        acc[key.toLowerCase()] = value;
        return acc;
      }, {} as { [key: string]: string });

      const escapedWords = Object.keys(corrections)
        .map(word => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regex = new RegExp(`(${escapedWords.join('|')})`, 'gi');

      const updatedSegments = this.segments().map(segment => {
        const correctedText = segment.text.replace(regex, (match) => {
          const replacement = lowerCaseCorrections[match.toLowerCase()];
          return replacement;
        });

        return {
          ...segment,
          text: correctedText
        };
      });

      if (!window.electron || !window.electron.writeJsonFileByPath) {
        throw new Error('Electron API for saving JSON is not available.');
      }

      const result = await window.electron.writeJsonFileByPath(this.jsonFilePath(), updatedSegments);

      if (result.success) {
        this.segments.set(updatedSegments);
        this.filterSegments();
        this.statusMessage.set(`✅ Applied ${this.correctionWords().length} corrections successfully!`);
        this.hasError.set(false);

        this.correctionsCompleted.emit({
          result: this.jsonFilePath(),
          success: true
        });
      } else {
        this.showError(result.error || 'Failed to save corrected segments');
      }
    } catch (error: any) {
      this.showError(`Error applying corrections: ${error.message || error}`);
    }
  }

  formatTime(seconds?: number): string {
    if (seconds === undefined || isNaN(seconds)) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

}