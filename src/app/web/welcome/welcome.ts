import { Component, inject, signal } from '@angular/core';
import { SharedService } from '../../core/shared.service';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-welcome',
  imports: [FormsModule],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css'
})
export class Welcome {

  public readonly sharedService = inject(SharedService);
  private readonly router = inject(Router);
  projectName = signal('');
  errorMessage = signal<string | null>(null);

  async createProject() {
    this.errorMessage.set(null);
    const trimmedProjectName = this.projectName().trim();

    if (!trimmedProjectName) {
      this.errorMessage.set('Project name is required.');
      return;
    };

    const result = await window.electron.createProject(trimmedProjectName);

    if (result?.success && result.path) {

      this.sharedService.set('projectName', trimmedProjectName);
      this.sharedService.setProjectName(trimmedProjectName);

      console.log('Project created at:', result.path);
      this.router.navigate(['/project']);
    } else {
      this.errorMessage.set(result?.error || 'Unknown error occurred');
    }

  }
}
