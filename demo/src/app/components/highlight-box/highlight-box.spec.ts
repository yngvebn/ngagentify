import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HighlightBox } from './highlight-box';

describe('HighlightBox', () => {
  let component: HighlightBox;
  let fixture: ComponentFixture<HighlightBox>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HighlightBox],
    }).compileComponents();

    fixture = TestBed.createComponent(HighlightBox);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
