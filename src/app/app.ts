import { Component, inject, OnInit } from '@angular/core';
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
  private readonly sharedService = inject(SharedService);
  private readonly router = inject(Router);

  ngOnInit(): void {

    const project = this.sharedService.get('projectPath');
    if (project) {
      this.router.navigate(['/project']);
    }
  }

  openProject() {
    console.log('Open Project clicked');
    // add your logic here
  }

  async saveProject() {

  }

  saveAsProject() {
    console.log('Save As clicked');
    // add your logic here
  }

  closeProject() {
    this.sharedService.set('projectPath', null);
  }
}

