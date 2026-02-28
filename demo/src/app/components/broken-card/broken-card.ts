import { Component } from '@angular/core';

// BUG: Title should say "Welcome to the App" — typo in template
// BUG: Button color should be green (#22c55e), not red (#ef4444)
@Component({
  selector: 'app-broken-card',
  imports: [],
  templateUrl: './broken-card.html',
  styleUrl: './broken-card.scss',
})
export class BrokenCard {}
