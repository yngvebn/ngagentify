import { Component } from '@angular/core';

@Component({
  // eslint-disable-next-line @angular-eslint/component-selector -- camelCase attr selector is conventional for directive-style components
  selector: '[appHighlightBox]',
  imports: [],
  templateUrl: './highlight-box.html',
  styleUrl: './highlight-box.scss',
})
export class HighlightBox {}
