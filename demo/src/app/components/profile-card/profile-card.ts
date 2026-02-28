import { Component, input } from '@angular/core';
import { KeyValuePipe } from '@angular/common';

@Component({
  selector: 'app-profile-card',
  imports: [KeyValuePipe],
  templateUrl: './profile-card.html',
  styleUrl: './profile-card.scss',
})
export class ProfileCard {
  name = input<string>('Default Name');
  age = input<number>(0);
  tags = input<string[]>([]);
  metadata = input<Record<string, unknown>>({});
}
