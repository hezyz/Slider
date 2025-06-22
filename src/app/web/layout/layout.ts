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
    throw new Error('Method not implemented.');
  }

  public readonly sharedService = inject(SharedService);
}
