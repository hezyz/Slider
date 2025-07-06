import { Component, computed, inject, OnInit } from '@angular/core';
import { SharedService } from '../../core/shared.service';
import { RouterOutlet } from '@angular/router';
import { OriginalSegmentModel, SegmentModel } from '../../core/segment.model';
import { SegmentService } from '../../core/segment.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout implements OnInit {

  public readonly sharedService = inject(SharedService);
  public readonly segmantService = inject(SegmentService);

  selectedImage = this.sharedService.selectedImage;

  async ngOnInit(): Promise<void> {
    const projectName = this.sharedService.projectName();
    if (!projectName) {
      console.warn('No project name set in SharedService');
      return;
    }

    try {
      this.loadImages(projectName);
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
      const results = await this.segmantService.writeSegmentsToFile(json.data, projectName, "segments.json");
      this.sharedService.setSegmnents(results);
    } else {
      console.error('Error loading JSON:', json.error);
    }

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
