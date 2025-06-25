import { Component, inject, input, OnInit } from '@angular/core';
import { SharedService } from '../../core/shared.service';

@Component({
  selector: 'app-layout',
  imports: [],
  templateUrl: './layout.html',
  styleUrl: './layout.css'
})
export class Layout implements OnInit {
  ngOnInit(): void {
    this.loadImages(this.sharedService.projectName() || '');
  }

  public readonly sharedService = inject(SharedService);

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
