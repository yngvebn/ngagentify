import { Component } from '@angular/core';
import { SimpleCard } from './components/simple-card/simple-card';
import { ProfileCard } from './components/profile-card/profile-card';
import { PageLayout } from './components/page-layout/page-layout';
import { StatsPanel } from './components/stats-panel/stats-panel';
import { HighlightBox } from './components/highlight-box/highlight-box';
import { TaskList } from './components/task-list/task-list';
import { BrokenCard } from './components/broken-card/broken-card';
@Component({
  selector: 'app-root',
  imports: [
    SimpleCard,
    ProfileCard,
    PageLayout,
    StatsPanel,
    HighlightBox,
    TaskList,
    BrokenCard,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = 'ng-annotate-demo';
}
