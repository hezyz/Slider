import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
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

  ngOnInit(): void {

    const project = this.sharedService.get('projectPath');
    if (project) {
      console.log('Project path:', project);
    } else {
      console.log('No project path found');
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

}

