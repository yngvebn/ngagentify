import { Component } from '@angular/core';
import { ContentBlock } from './content-block/content-block';

@Component({
  selector: 'app-section-panel',
  imports: [ContentBlock],
  templateUrl: './section-panel.html',
  styleUrl: './section-panel.scss',
})
export class SectionPanel {}
