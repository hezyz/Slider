import { Component, inject } from '@angular/core';
import { SharedService } from '../../core/shared.service';

@Component({
  selector: 'app-editor',
  imports: [],
  templateUrl: './editor.html',
  styleUrl: './editor.css'
})
export class Editor {

    private readonly sharedService = inject(SharedService);
  
  selectedImage = this.sharedService.selectedImage;
}
