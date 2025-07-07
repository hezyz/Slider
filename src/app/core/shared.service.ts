import { Injectable, signal, WritableSignal } from '@angular/core';
import { SegmentModel } from './segment.model';

@Injectable({ providedIn: 'root' })
export class SharedService {

  //shared
  projectName = signal<string | null>(null);
  imagePaths = signal<string[]>([]);
  selectedImage = signal<string | null>(null);

  segments = signal<SegmentModel[]>([])

   async loadImages(projectName: string) {
    if (!projectName) {
      console.log('No project selected.');
      return;
    }
    const result = await window.electron.getProjectImages(projectName);

    if (result.success) {
      console.log('Image paths:', result.files?.length);
      const sortedPaths = this.sortImagePathsByNumber(result.files || []);
      this.imagePaths.set(sortedPaths);
      this.selectedImage.set(this.imagePaths()[0] || '');
    } else {
      console.error('Failed to load images:', result.error);
    }
  }

  closeProject(){
    this.projectName.set(null);
    this.imagePaths.set([]);
    this.selectedImage.set(null);
    this.segments.set([]);
    this.remove('projectName');
  }

  setProjectName(path: string | null) {
    this.projectName.set(path);
  }

  setImages(images: string[]) {
    this.imagePaths.set(images);
    if (images.length > 0) {
      this.selectedImage.set(images[0]);
    }
  }

  selectImage(image: string) {
    this.selectedImage.set(image);
  }

  setSegmnents(segments: SegmentModel[]) {
    this.segments.set(segments);
  }
  
  //Loacal storeage
  private signals = new Map<string, WritableSignal<unknown>>();

  // Get raw value
  get<T>(key: string): T | null {
    const item = localStorage.getItem(key);
    try {
      return item ? JSON.parse(item) as T : null;
    } catch {
      return null;
    }
  }

  // Save to localStorage and update signal if exists
  set<T>(key: string, value: T): void {
    localStorage.setItem(key, JSON.stringify(value));
    const sig = this.signals.get(key);
    if (sig) {
      (sig as WritableSignal<T | null>).set(value);
    }
  }

  // Remove key and update signal
  remove(key: string): void {
    localStorage.removeItem(key);
    const sig = this.signals.get(key);
    if (sig) {
      (sig as WritableSignal<null>).set(null);
    }
  }

  // Clear all preferences and signals
  clear(): void {
    localStorage.clear();
    this.signals.forEach(sig => sig.set(null));
  }

  // Type-safe signal getter
  getSignal<T>(key: string): WritableSignal<T | null> {
    if (!this.signals.has(key)) {
      const stored = this.get<T>(key);
      const newSignal = signal<T | null>(stored);
      this.signals.set(key, newSignal);
      return newSignal;
    }

    // Type assertion — safe because it's managed by us
    return this.signals.get(key) as WritableSignal<T | null>;
  }

  /* Helpers */
    private sortImagePathsByNumber(paths: string[]): string[] {
    return paths.slice().sort((a, b) => {
      const extractNumber = (filePath: string): number => {
        const fileName = filePath.split('/').pop() || '';
        const match = fileName.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };

      return extractNumber(a) - extractNumber(b);
    });
  }
}
