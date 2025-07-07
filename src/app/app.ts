import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SharedService } from './core/shared.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  protected title = 'Slider';
  public readonly sharedService = inject(SharedService);
  private readonly router = inject(Router);

  projectName = signal('');
  slideInput = 1;

  // Computed properties for navigation
  get currentIndex() {
    return this.sharedService.imagePaths().indexOf(this.sharedService.selectedImage() || '');
  }

  get hasPrevious() {
    return this.currentIndex > 0;
  }

  get hasNext() {
    return this.currentIndex < this.sharedService.imagePaths().length - 1;
  }

  get isProjectLoaded() {
    return this.sharedService.projectName() !== null;
  }

  ngOnInit(): void {
    const project: string | null = this.sharedService.get('projectName');
    if (project) {
      this.sharedService.setProjectName(project);
      this.projectName.set(project);
      this.router.navigate(['/project']);
    } else {
      this.router.navigate(['/']);
    }
  }

  async openProject() {
    const result = await window.electron.selectJsonFile();

    if (result.canceled) {
      console.log('User cancelled file selection.');
      return;
    }

    const filePath = result.filePath!;
    const json = await window.electron.readJsonFile(filePath);

    if (json.success) {
      console.log('Project loaded:', json.data.name);
      this.sharedService.remove('projectName');
      this.sharedService.set('projectName', json.data.name);
      this.sharedService.setProjectName(json.data.name);
      this.projectName.set(json.data.name);
      this.router.navigate(['/project']);
    } else {
      console.error('Error loading JSON:', json.error);
    }
  }

  async saveProject() {
    // Implementation for save project
  }

  saveAsProject() {
    console.log('Save As clicked');
    // add your logic here
  }

  closeProject() {
    this.sharedService.set('projectName', null);
    this.router.navigate(['/']);
  }

  // Navigation methods moved from layout
  syncSlideInput() {
    this.slideInput = this.currentIndex + 1;
  }

  goToPrevious() {
    const idx = this.currentIndex;
    const paths = this.sharedService.imagePaths();
    if (idx > 0) {
      this.sharedService.selectedImage.set(paths[idx - 1]);
      this.syncSlideInput();
    }
  }

  goToNext() {
    const idx = this.currentIndex;
    const paths = this.sharedService.imagePaths();
    if (idx < paths.length - 1) {
      this.sharedService.selectedImage.set(paths[idx + 1]);
      this.syncSlideInput();
    }
  }

  goToSlide() {
    const index = this.slideInput - 1;
    const paths = this.sharedService.imagePaths();
    if (index >= 0 && index < paths.length) {
      this.sharedService.selectedImage.set(paths[index]);
      this.syncSlideInput();
    } else {
      alert(`Slide number must be between 1 and ${paths.length}`);
    }
  }

  goToStart() {
    const paths = this.sharedService.imagePaths();
    if (paths.length > 0) {
      this.sharedService.selectedImage.set(paths[0]);
      this.syncSlideInput();
    }
  }

  goToEnd() {
    const paths = this.sharedService.imagePaths();
    if (paths.length > 0) {
      this.sharedService.selectedImage.set(paths[paths.length - 1]);
      this.syncSlideInput();
    }
  }

  async importImages() {
    const projectName = this.sharedService.projectName();

    if (!projectName) {
      console.log('No project selected.');
      return;
    }

    const result = await window.electron.importImages(projectName);

    if (result.success) {
      // Let the layout component handle reloading images
      console.log('Merged images:', result.images?.length);
      // You might want to emit an event or call a method to refresh images
    } else {
      console.log('Error importing images:', result.error);
    }
  }
}