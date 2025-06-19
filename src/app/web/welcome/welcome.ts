import { Component, inject } from '@angular/core';
import { SharedService } from '../../core/shared.service';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-welcome',
  imports: [FormsModule],
  templateUrl: './welcome.html',
  styleUrl: './welcome.css'
})
export class Welcome {

  private readonly sharedService = inject(SharedService);
 projectName: string = '';
   errorMessage: string | null = null;

  createProject(){
    this.sharedService.set('projectPath', '/path/to/project');
  }
}
