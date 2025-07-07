import { Component, computed, inject, signal } from '@angular/core';
import { SharedService } from '../../core/shared.service';
import { FormsModule } from '@angular/forms';
import { SegmentModel } from '../../core/segment.model';
import { SegmentService } from '../../core/segment.service';

@Component({
  selector: 'app-editor',
  imports: [FormsModule],
  templateUrl: './editor.html',
  styleUrl: './editor.css'
})
export class Editor {


  private readonly sharedService = inject(SharedService);
  private readonly segmentService = inject(SegmentService);

  readonly selectedImage = this.sharedService.selectedImage;

  currentIndex = computed(() =>
    this.sharedService.imagePaths().indexOf(this.sharedService.selectedImage() || '')
  );

  readonly filteredSegments = computed(() =>
    this.sharedService.segments().filter(segment => segment.slide === this.currentIndex() + 1)
  );

  originalSegments = new Map<number, SegmentModel>();

  // Track last index to reset editing state
  lastSlideIndex = -1;
  editingIndex = signal<number | null>(null);

  ngDoCheck() {
    if (this.currentIndex() !== this.lastSlideIndex) {
      this.editingIndex.set(null);
      this.lastSlideIndex = this.currentIndex();
    }
  }

  toggleEdit(index: number) {
    const segment = this.filteredSegments()[index];
    this.editingIndex.set(this.editingIndex() === index ? null : index);

    if (!this.originalSegments.has(segment.id)) {
      // Deep clone to avoid reference updates
      this.originalSegments.set(segment.id, { ...segment });
    }
  }

  toggleRemove(id: number) {
    const confirmDelete = window.confirm('Are you sure you want to remove this segment from the slide?');

    if (confirmDelete) {
      const segments = this.sharedService.segments().map(segment =>
        segment.id === id ? { ...segment, slide: 0 } : segment
      );

      this.sharedService.setSegmnents(segments); // trigger reactivity
    }
  }

  async saveEdit(index: number) {
    const segment = this.filteredSegments()[index];
    await this.saveSegments();
    this.originalSegments.delete(segment.id);
    this.editingIndex.set(null);
  }

  cancelEdit(index: number) {
    const segment = this.filteredSegments()[index];
    const backup = this.originalSegments.get(segment.id);
    if (backup) {
      // Update sharedService's list with restored segment
      const restoredList = this.sharedService.segments().map(s =>
        s.id === backup.id ? { ...backup } : s
      );
      this.sharedService.setSegmnents(restoredList);
    }
    this.originalSegments.delete(segment.id);
    this.editingIndex.set(null);
  }


  async saveSegments() {
    const projectName = this.sharedService.projectName();

    if (!projectName) {
      console.warn('No project name set in SharedService');
      return;
    }

    try {
      await this.segmentService.saveSegmentsToFile(this.sharedService.segments(), projectName, "segments.json");
      console.log('✅ Segments saved successfully.');
      //alert('Segments saved successfully.');
    } catch (err) {
      console.error('❌ Failed to save segments:', err);
      alert('Failed to save segments. Please try again.');
    }
  }
}
