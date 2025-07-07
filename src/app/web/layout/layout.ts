import { Component, computed, ElementRef, inject, signal, ViewChild, effect, AfterViewInit, OnDestroy } from '@angular/core';
import { SharedService } from '../../core/shared.service';
import { RouterOutlet } from '@angular/router';
import { SegmentModel } from '../../core/segment.model';
import { SegmentService } from '../../core/segment.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout implements AfterViewInit, OnDestroy { // Implement AfterViewInit and OnDestroy

  public readonly sharedService = inject(SharedService);
  public readonly segmentService = inject(SegmentService);

  readonly selectedImage = this.sharedService.selectedImage;

  currentIndex = computed(() =>
    this.sharedService.imagePaths().indexOf(this.sharedService.selectedImage() || '')
  );

  //Drag scroll
  @ViewChild('scrollContainer') scrollContainer!: ElementRef<HTMLElement>; // No static: true

  private isDragging = signal(false);
  private startX = 0;
  private scrollLeft = 0;

  constructor() {
    // Watch for changes in currentIndex and auto-scroll
    effect(() => {
      const index = this.currentIndex();
      if (index >= 0) {
        // Use setTimeout to ensure DOM is updated
        // This setTimeout might not always be reliable for DOM updates if rendering takes longer.
        // Consider using NgZone.runOutsideAngular for performance-critical DOM manipulations
        // or ensure the effect runs after Angular's change detection.
        setTimeout(() => this.scrollToSelectedImage(), 100);
      }
    });
  }

  ngAfterViewInit() {
    // Ensure scrollContainer is available after view initialization
    if (this.scrollContainer) {
      // It's generally better to add event listeners in ngAfterViewInit for ViewChild elements
      // if they are not static.
    }
  }

  /* Actions */
  async addSegment(segment: SegmentModel) {
    const segments = this.sharedService.segments().map(s => {
      if (s.id === segment.id) {
        return { ...s, slide: this.currentIndex() + 1 };
      }
      return s;
    });

    this.sharedService.setSegmnents(segments);
    await this.saveSegments();
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
    } catch (err) {
      console.error('❌ Failed to save segments:', err);
      alert('Failed to save segments. Please try again.');
    }
  }

  select(img: string) {
    this.sharedService.selectImage(img);
    // The effect will automatically trigger scrollToSelectedImage()
  }

  scrollToSelectedImage() {
    // This method needs to scroll the `.left-column-scroll` div, not the image list.
    // Ensure the selector correctly targets the scrollable container.
    const currentSlide = this.currentIndex() + 1;

    const el = document.querySelector(`#segment-${currentSlide}`) as HTMLElement;
    const container = document.querySelector('.left-column-scroll') as HTMLElement; // Ensure this selector is correct

    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const scrollOffset = elTop - containerTop + container.scrollTop;

      container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
    }
  }

  startDrag(event: MouseEvent) {
    if (!this.scrollContainer?.nativeElement) return;

    const el = this.scrollContainer.nativeElement;
    this.isDragging.set(true);
    this.startX = event.pageX - el.offsetLeft;
    this.scrollLeft = el.scrollLeft;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none'; // Prevent text selection
    event.preventDefault();

    // Bind event listeners with 'this' context
    document.addEventListener('mousemove', this.handleMouseMoveBounded, { passive: false });
    document.addEventListener('mouseup', this.handleMouseUpBounded, { passive: false });
    // Using `mouseleave` on `document` can sometimes be tricky. Consider listening on `el` itself for `mouseleave` or only relying on `mouseup`.
    document.addEventListener('mouseleave', this.handleMouseUpBounded, { passive: false });
  }

  // Use arrow functions or bind in the constructor/startDrag to preserve 'this' context
  private handleMouseMove = (event: MouseEvent) => {
    if (!this.isDragging() || !this.scrollContainer?.nativeElement) return;

    const el = this.scrollContainer.nativeElement;
    const x = event.pageX - el.offsetLeft;
    const walk = (x - this.startX) * 1.5; // Adjust sensitivity as needed
    el.scrollLeft = this.scrollLeft - walk;
    event.preventDefault();
  }

  private handleMouseUp = () => {
    this.isDragging.set(false);
    if (this.scrollContainer?.nativeElement) {
      this.scrollContainer.nativeElement.style.cursor = 'grab';
      this.scrollContainer.nativeElement.style.userSelect = '';
    }

    // Remove global event listeners
    document.removeEventListener('mousemove', this.handleMouseMoveBounded);
    document.removeEventListener('mouseup', this.handleMouseUpBounded);
    document.removeEventListener('mouseleave', this.handleMouseUpBounded);
  }

  // Bounded versions of the handlers to ensure 'this' context
  private handleMouseMoveBounded = this.handleMouseMove.bind(this);
  private handleMouseUpBounded = this.handleMouseUp.bind(this);


  // Add this method to handle drag leave events (on the container itself)
  onDragLeave() {
    // Only call handleMouseUp if actively dragging within the container
    if (this.isDragging()) {
      this.handleMouseUp();
    }
  }

  // Clean up event listeners when component is destroyed
  ngOnDestroy() {
    // Ensure all event listeners are removed to prevent memory leaks
    document.removeEventListener('mousemove', this.handleMouseMoveBounded);
    document.removeEventListener('mouseup', this.handleMouseUpBounded);
    document.removeEventListener('mouseleave', this.handleMouseUpBounded);
  }
}