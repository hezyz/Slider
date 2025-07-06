import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SharedService } from './core/shared.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {

  protected title = 'Slider';
  public readonly sharedService = inject(SharedService);
  private readonly router = inject(Router);

  projectName = signal('');

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

  }

  saveAsProject() {
    console.log('Save As clicked');
    // add your logic here
  }

  closeProject() {
    this.sharedService.set('projectName', null);
  }
}

