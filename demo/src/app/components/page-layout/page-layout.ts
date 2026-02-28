import { Component } from '@angular/core';
import { SectionPanel } from './section-panel/section-panel';

@Component({
  selector: 'app-page-layout',
  imports: [SectionPanel],
  templateUrl: './page-layout.html',
  styleUrl: './page-layout.scss',
})
export class PageLayout {}
