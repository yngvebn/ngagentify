import { Component, Input } from '@angular/core';
import { TaskItem } from './task-item/task-item';

@Component({
  selector: 'app-task-list',
  imports: [TaskItem],
  templateUrl: './task-list.html',
  styleUrl: './task-list.scss',
})
export class TaskList {
  @Input() items: string[] = [];
}
