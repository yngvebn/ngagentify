import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SectionPanel } from './section-panel';

describe('SectionPanel', () => {
  let component: SectionPanel;
  let fixture: ComponentFixture<SectionPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SectionPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(SectionPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
