import { CommonModule } from '@angular/common';
import { Component, signal, computed, input, output, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface CorrectionRule {
  id: string;
  wrong: string;
  correct: string;
}

@Component({
  selector: 'app-corrections-manager',
  imports: [CommonModule, FormsModule],
  templateUrl: './corrections-manager.html',
  styleUrl: './corrections-manager.css'
})
export class CorrectionsManager implements OnInit, OnDestroy {
  // Inputs
  jsonFilePath = input.required<string>();
  
  // Outputs
  correctionsChanged = output<{ [key: string]: string }>();
  statusUpdate = output<{ message: string; hasError: boolean }>();

  // Signals
  isLoading = signal<boolean>(false);
  corrections = signal<CorrectionRule[]>([]);
  isEditing = signal<string | null>(null);
  editingRule = signal<{ wrong: string; correct: string }>({ wrong: '', correct: '' });
  newRule = signal<{ wrong: string; correct: string }>({ wrong: '', correct: '' });
  showAddForm = signal<boolean>(false);
  searchTerm = signal<string>('');

  // Computed properties
  filteredCorrections = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) {
      return this.corrections();
    }
    return this.corrections().filter(rule => 
      rule.wrong.toLowerCase().includes(term) || 
      rule.correct.toLowerCase().includes(term)
    );
  });

  correctionsObject = computed(() => {
    const obj: { [key: string]: string } = {};
    this.corrections().forEach(rule => {
      obj[rule.wrong] = rule.correct;
    });
    return obj;
  });

  totalCorrections = computed(() => this.corrections().length);

  ngOnInit() {
    this.loadCorrections();
  }

  ngOnDestroy() {
    // Clean up any listeners if needed
  }

  async loadCorrections() {
    this.isLoading.set(true);
    this.emitStatus('Loading corrections...', false);

    try {
      if (!window.electron || !window.electron.readJsonFile || !window.electron.getAppPath) {
        throw new Error('Electron API not available.');
      }

      const appPathResult = await window.electron.getAppPath();
      const correctionFilePath = appPathResult.path + "/corrections.json";
      const result = await window.electron.readJsonFile(correctionFilePath);

      if (result.success) {
        this.loadCorrectionsFromObject(result.data);
        this.emitStatus(`Loaded ${this.corrections().length} correction rules`, false);
      } else {
        this.emitStatus('No corrections file found, starting with empty list', false);
        this.corrections.set([]);
      }
    } catch (error: any) {
      this.emitStatus(`Failed to load corrections: ${error.message || error}`, true);
      this.corrections.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  async saveCorrections() {
    if (!window.electron || !window.electron.writeJsonFile || !window.electron.getAppPath) {
      this.emitStatus('Cannot save: Electron API not available', true);
      return;
    }

    try {
      const appPathResult = await window.electron.getAppPath();
      const correctionFilePath = appPathResult.path + "/corrections.json";
      
      const result = await window.electron.writeJsonFileByPath(correctionFilePath, this.correctionsObject());
      
      if (result.success) {
        this.emitStatus('Corrections saved successfully', false);
        this.emitCorrectionsChanged();
      } else {
        this.emitStatus(result.error || 'Failed to save corrections', true);
      }
    } catch (error: any) {
      this.emitStatus(`Error saving corrections: ${error.message || error}`, true);
    }
  }

  // Add new correction rule
  async addCorrection() {
    const rule = this.newRule();
    
    if (!rule.wrong.trim() || !rule.correct.trim()) {
      this.emitStatus('Both wrong and correct text are required', true);
      return;
    }

    // Check if rule already exists
    const existing = this.corrections().find(r => r.wrong === rule.wrong.trim());
    if (existing) {
      this.emitStatus('A correction rule for this word already exists', true);
      return;
    }

    const newRule: CorrectionRule = {
      id: this.generateId(),
      wrong: rule.wrong.trim(),
      correct: rule.correct.trim()
    };

    this.corrections.set([...this.corrections(), newRule]);
    this.newRule.set({ wrong: '', correct: '' });
    this.showAddForm.set(false);
    
    await this.saveCorrections();
  }

  // Start editing a correction rule
  startEdit(rule: CorrectionRule) {
    this.isEditing.set(rule.id);
    this.editingRule.set({ wrong: rule.wrong, correct: rule.correct });
  }

  // Save edited correction rule
  async saveEdit() {
    const editingId = this.isEditing();
    const editedRule = this.editingRule();

    if (!editingId || !editedRule.wrong.trim() || !editedRule.correct.trim()) {
      this.emitStatus('Both wrong and correct text are required', true);
      return;
    }

    // Check if the new wrong text conflicts with existing rules (excluding current rule)
    const existing = this.corrections().find(r => r.id !== editingId && r.wrong === editedRule.wrong.trim());
    if (existing) {
      this.emitStatus('A correction rule for this word already exists', true);
      return;
    }

    const updatedCorrections = this.corrections().map(rule => 
      rule.id === editingId 
        ? { ...rule, wrong: editedRule.wrong.trim(), correct: editedRule.correct.trim() }
        : rule
    );

    this.corrections.set(updatedCorrections);
    this.cancelEdit();
    
    await this.saveCorrections();
  }

  // Cancel editing
  cancelEdit() {
    this.isEditing.set(null);
    this.editingRule.set({ wrong: '', correct: '' });
  }

  // Delete correction rule
  async deleteCorrection(id: string) {
    if (!confirm('Are you sure you want to delete this correction rule?')) {
      return;
    }

    const updatedCorrections = this.corrections().filter(rule => rule.id !== id);
    this.corrections.set(updatedCorrections);
    
    await this.saveCorrections();
  }

  // Load default corrections
  async loadDefaults() {
    const defaultCorrections = {
      "OneOtra": "One no Trump",
      "OneOtrump": "One no Trump",
      "103": "One no Trump",
      "וOneSpring": "one Spade",
      "1 or Trump": "One no Trump",
      "באלפא": "בעל פה",
      "בריץ": "ברידג",
      "בכל אור": "בכל זאת",
      "דומה": "דומם",
      "הבריץ'": "ברידג"
    };

    this.loadCorrectionsFromObject(defaultCorrections);
    await this.saveCorrections();
  }

  // Clear all corrections
  async clearAll() {
    if (!confirm('Are you sure you want to clear all correction rules?')) {
      return;
    }

    this.corrections.set([]);
    await this.saveCorrections();
  }

  // Toggle add form
  toggleAddForm() {
    this.showAddForm.set(!this.showAddForm());
    if (this.showAddForm()) {
      this.newRule.set({ wrong: '', correct: '' });
    }
  }

  // Search corrections
  searchCorrections() {
    // The filtering is handled by the computed property
  }

  // Helper methods
  private loadCorrectionsFromObject(obj: { [key: string]: string }) {
    const rules: CorrectionRule[] = Object.entries(obj).map(([wrong, correct]) => ({
      id: this.generateId(),
      wrong,
      correct
    }));
    this.corrections.set(rules);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private emitStatus(message: string, hasError: boolean) {
    this.statusUpdate.emit({ message, hasError });
  }

  private emitCorrectionsChanged() {
    this.correctionsChanged.emit(this.correctionsObject());
  }

  // Public method to get corrections for parent component
  getCorrections(): { [key: string]: string } {
    return this.correctionsObject();
  }
}