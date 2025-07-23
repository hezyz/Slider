import { CommonModule } from '@angular/common';
import { Component, signal, computed, inject } from '@angular/core';
import { SharedService } from '../../../core/shared.service';
import { VideoExtractStep } from '../video-extract-step/video-extract-step';
import { TranscriptionStep } from '../transcription-step/transcription-step';
import { CorrectionsStep } from '../corrections-step/corrections-step';
import { TranslationStep } from '../translation-step/translation-step';

@Component({
  selector: 'app-audio-workflow',
  imports: [
    CommonModule,
    VideoExtractStep,
    TranscriptionStep,
    CorrectionsStep,
    TranslationStep
  ],
  templateUrl: './audio-workflow.html',
  styleUrl: './audio-workflow.css'
})
export class AudioWorkflow {
  private sharedService = inject(SharedService);

  // Workflow state signals
  currentStep = signal<number>(1);
  videoLoaded = signal<boolean>(false);
  audioExtracted = signal<boolean>(false);
  transcriptionCompleted = signal<boolean>(false);
  correctionsCompleted = signal<boolean>(false);
  translationCompleted = signal<boolean>(false);
  
  // Data signals
  videoPath = signal<string>('');
  audioPath = signal<string>('');
  transcriptionPath = signal<string>('');
  correctedTextPath = signal<string>('');
  translatedTextPath = signal<string>('');
  finalResult = signal<string>('');

  // Computed properties
  projectName = computed(() => this.sharedService.projectName());
  hasProject = computed(() => !!this.projectName());

  // Progress steps configuration
  steps = [
    {
      id: 1,
      title: 'Load Video & Extract Voice',
      description: 'Select video file and extract audio',
      icon: 'bi-camera-video'
    },
    {
      id: 2,
      title: 'Transcription',
      description: 'Convert audio to text',
      icon: 'bi-file-text'
    },
    {
      id: 3,
      title: 'Text Corrections',
      description: 'Review and correct text',
      icon: 'bi-pencil-square'
    },
    {
      id: 4,
      title: 'Translation',
      description: 'Translate text to target language',
      icon: 'bi-translate'
    }
  ];

  // Step 1 event handlers
  onVideoLoaded(data: { videoPath: string }) {
    this.videoPath.set(data.videoPath);
    this.videoLoaded.set(true);
  }

  onAudioExtracted(data: { audioPath: string; success: boolean }) {
    if (data.success) {
      this.audioPath.set(data.audioPath);
      this.audioExtracted.set(true);
      this.currentStep.set(2);
    }
  }

  // Step 2 event handlers
  onTranscriptionCompleted(data: { result: string; success: boolean }) {
    if (data.success) {
      this.transcriptionPath.set(data.result);
      this.transcriptionCompleted.set(true);
      this.currentStep.set(3);
    }
  }

  // Step 3 event handlers
  onCorrectionsCompleted(data: { result: string; success: boolean }) {
    if (data.success) {
      this.correctedTextPath.set(data.result);
      this.correctionsCompleted.set(true);
      this.currentStep.set(4);
    }
  }

  // Step 4 event handlers (NEW)
  onTranslationCompleted(data: { result: string; success: boolean }) {
    if (data.success) {
      this.translatedTextPath.set(data.result);
      this.translationCompleted.set(true);
      this.finalResult.set(data.result);
    }
  }

  // Step navigation
  goToStep(stepNumber: number) {
    if (stepNumber === 1) {
      this.currentStep.set(1);
    } else if (stepNumber === 2 && this.audioExtracted()) {
      this.currentStep.set(2);
    } else if (stepNumber === 3 && this.transcriptionCompleted()) {
      this.currentStep.set(3);
    } else if (stepNumber === 4 && this.correctionsCompleted()) {
      this.currentStep.set(4);
    }
  }

  // Load existing JSON file and jump to step 3 (corrections)
  async loadJsonFile() {
    try {
      const result = await window.electron.selectJsonFile();
      if (result && !result.canceled && result.filePath) {
        this.transcriptionPath.set(result.filePath);
        this.transcriptionCompleted.set(true);
        this.currentStep.set(3);
      }
    } catch (error) {
      console.error('Failed to load JSON file:', error);
    }
  }

  // Load existing corrected JSON file and jump to step 4 (translation)
  async loadCorrectedJsonFile() {
    try {
      const result = await window.electron.selectJsonFile();
      if (result && !result.canceled && result.filePath) {
        this.correctedTextPath.set(result.filePath);
        this.transcriptionCompleted.set(true);
        this.correctionsCompleted.set(true);
        this.currentStep.set(4);
      }
    } catch (error) {
      console.error('Failed to load corrected JSON file:', error);
    }
  }

  // Step status helpers
  getStepStatus(stepId: number): 'completed' | 'active' | 'disabled' {
    if (stepId === 1) {
      if (this.audioExtracted()) return 'completed';
      if (this.currentStep() === 1) return 'active';
      return 'disabled';
    }
    
    if (stepId === 2) {
      if (this.transcriptionCompleted()) return 'completed';
      if (this.currentStep() === 2 && this.audioExtracted()) return 'active';
      return 'disabled';
    }
    
    if (stepId === 3) {
      if (this.correctionsCompleted()) return 'completed';
      if (this.currentStep() === 3 && this.transcriptionCompleted()) return 'active';
      return 'disabled';
    }
    
    if (stepId === 4) {
      if (this.translationCompleted()) return 'completed';
      if (this.currentStep() === 4 && this.correctionsCompleted()) return 'active';
      return 'disabled';
    }
    
    return 'disabled';
  }

  isStepAccessible(stepId: number): boolean {
    if (stepId === 1) return true;
    if (stepId === 2) return this.audioExtracted();
    if (stepId === 3) return this.transcriptionCompleted();
    if (stepId === 4) return this.correctionsCompleted();
    return false;
  }

  // Reset workflow
  resetWorkflow() {
    this.currentStep.set(1);
    this.videoLoaded.set(false);
    this.audioExtracted.set(false);
    this.transcriptionCompleted.set(false);
    this.correctionsCompleted.set(false);
    this.translationCompleted.set(false);
    this.videoPath.set('');
    this.audioPath.set('');
    this.transcriptionPath.set('');
    this.correctedTextPath.set('');
    this.translatedTextPath.set('');
    this.finalResult.set('');
  }
}