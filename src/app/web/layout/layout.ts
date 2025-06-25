import { Component, computed, inject, OnInit } from '@angular/core';
import { SharedService } from '../../core/shared.service';
import { RouterOutlet } from '@angular/router';
import { SegmentModel } from '../../core/segment.model';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout implements OnInit {

  public readonly sharedService = inject(SharedService);
  selectedImage = this.sharedService.selectedImage;

  ngOnInit(): void {
    this.loadImages(this.sharedService.projectName() || '');
  }

  /* Actions */
  select(img: string) {
    this.sharedService.selectImage(img);
  }

  currentIndex = computed(() =>
    this.sharedService.imagePaths().indexOf(this.selectedImage() || '')
  );

  hasPrevious = computed(() => this.currentIndex() > 0);
  hasNext = computed(() => this.currentIndex() < this.sharedService.imagePaths().length - 1);

  goToPrevious() {
    const idx = this.currentIndex();
    if (idx > 0) {
      this.selectedImage.set(this.sharedService.imagePaths()[idx - 1]);
    }
  }

  goToNext() {
    const idx = this.currentIndex();
    if (idx < this.sharedService.imagePaths().length - 1) {
      this.selectedImage.set(this.sharedService.imagePaths()[idx + 1]);
    }
  }

  async loadTranslated() {

    const result = await window.electron.selectJsonFile();

    if (result.canceled) {
      console.log('User cancelled file selection.');
      return;
    }

    const filePath = result.filePath!;
    const json = await window.electron.readJsonFile(filePath);

    if (json.success) {
      console.log('Project loaded:', json.data);
      const segments = this.convertToSegmentModels(json.data || []);
      this.sharedService.setSegmnents(segments);
      console.log('Segments:', this.sharedService.segments());
    } else {
      console.error('Error loading JSON:', json.error);
    }

  }

  /* Json Convertot */
  convertToSegmentModels(jsonArray: any[]): SegmentModel[] {
    return jsonArray.map((item, index) => ({
      id: index,
      text: item.text ?? '',
      translation: '', // default empty; update later if needed
      startTime: item.start ?? 0,
      endTime: item.end ?? 0,
      slide: item.slide ?? 0,
      type: item.type ?? 'text'
    }));
  }
  
  /* Manage Slides  */
  async importImages() {
      const projectName = this.sharedService.projectName();

      if (!projectName) {
        console.log('No project selected.');
        return;
      }

      const result = await window.electron.importImages(projectName);

      if (result.success) {
        this.loadImages(projectName);
        console.log('Merged images:', result.images?.length);
      } else {
        console.log('Error importing images:', result.error);
      }
    }

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

  }
