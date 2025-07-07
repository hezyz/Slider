import { Component, computed, ElementRef, inject, OnInit, signal, ViewChild, effect } from '@angular/core';
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
export class Layout implements OnInit {

  public readonly sharedService = inject(SharedService);
  public readonly segmentService = inject(SegmentService);

  readonly selectedImage = this.sharedService.selectedImage;

  currentIndex = computed(() =>
    this.sharedService.imagePaths().indexOf(this.sharedService.selectedImage() || '')
  );

  //Drag scroll
  @ViewChild('scrollContainer', { static: true }) scrollContainer!: ElementRef<HTMLElement>;

  private isDragging = signal(false);
  private startX = 0;
  private scrollLeft = 0;

  constructor() {
    // Watch for changes in currentIndex and auto-scroll
    effect(() => {
      const index = this.currentIndex();
      if (index >= 0) {
        // Use setTimeout to ensure DOM is updated
        setTimeout(() => this.scrollToSelectedImage(), 100);
      }
    });
  }

  async ngOnInit(): Promise<void> {
    const projectName = this.sharedService.projectName();
    if (!projectName) {
      console.warn('No project name set in SharedService');
      return;
    }

    try {
      await this.loadImages(projectName);
      const filePath = (await window.electron.getProjectPath(projectName)).path + "/segments.json";
      const json = await window.electron.readJsonFile(filePath || '');
      if (json.success) {
        this.sharedService.setSegmnents(json.data as SegmentModel[]);
      }
    } catch (err) {
      console.error('❌ Failed to get project path:', err);
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
    const currentSlide = this.currentIndex() + 1;

    const el = document.querySelector(`#segment-${currentSlide}`) as HTMLElement;
    const container = document.querySelector('.left-column-scroll') as HTMLElement;

    if (el && container) {
      const elTop = el.getBoundingClientRect().top;
      const containerTop = container.getBoundingClientRect().top;
      const scrollOffset = elTop - containerTop + container.scrollTop;

      container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
    }
  }

  async loadTranslated() {
    const projectName = this.sharedService.projectName();
    if (!projectName) {
      console.warn('No project name set in SharedService');
      return;
    }
    const result = await window.electron.selectJsonFile();

    if (result.canceled) {
      console.log('User cancelled file selection.');
      return;
    }

    const filePath = result.filePath!;
    await window.electron.copyFileAndCreateSegments({
      sourcePath: filePath,
      projectName: projectName,
    });

    const json = await window.electron.readJsonFile(filePath);

    if (json.success) {
      const results = await this.segmentService.writeSegmentsToFile(json.data, projectName, "segments.json");
      this.sharedService.setSegmnents(results);
    } else {
      console.error('Error loading JSON:', json.error);
    }
  }

  /* Manage Slides  */
  async loadImages(projectName: string) {
    if (!projectName) {
      console.log('No project selected.');
      return;
    }
    const result = await window.electron.getProjectImages(projectName);

    if (result.success) {
      console.log('Image paths:', result.files?.length);
      const sortedPaths = this.sortImagePathsByNumber(result.files || []);
      this.sharedService.imagePaths.set(sortedPaths);
      this.selectedImage.set(this.sharedService.imagePaths()[0] || '');
    } else {
      console.error('Failed to load images:', result.error);
    }
  }

  sortImagePathsByNumber(paths: string[]): string[] {
    return paths.slice().sort((a, b) => {
      const extractNumber = (filePath: string): number => {
        const fileName = filePath.split('/').pop() || '';
        const match = fileName.match(/\d+/);
        return match ? parseInt(match[0], 10) : 0;
      };

      return extractNumber(a) - extractNumber(b);
    });
  }

  startDrag(event: MouseEvent) {
    const el = this.scrollContainer.nativeElement;
    this.isDragging.set(true);
    this.startX = event.pageX - el.offsetLeft;
    this.scrollLeft = el.scrollLeft;
    el.style.cursor = 'grabbing';
    event.preventDefault();
  }

  onDrag(event: MouseEvent) {
    if (!this.isDragging()) return;

    const el = this.scrollContainer.nativeElement;
    const x = event.pageX - el.offsetLeft;
    const walk = (x - this.startX) * 1.5;
    el.scrollLeft = this.scrollLeft - walk;
  }

  endDrag() {
    this.isDragging.set(false);
    this.scrollContainer.nativeElement.style.cursor = 'grab';
  }
}