import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatsPanel } from './stats-panel';

describe('StatsPanel', () => {
  let component: StatsPanel;
  let fixture: ComponentFixture<StatsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatsPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(StatsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
