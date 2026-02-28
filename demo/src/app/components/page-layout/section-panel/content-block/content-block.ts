import { Component } from '@angular/core';
import { LeafWidget } from './leaf-widget/leaf-widget';

@Component({
  selector: 'app-content-block',
  imports: [LeafWidget],
  templateUrl: './content-block.html',
  styleUrl: './content-block.scss',
})
export class ContentBlock {}
