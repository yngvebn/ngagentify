import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LeafWidget } from './leaf-widget';

describe('LeafWidget', () => {
  let component: LeafWidget;
  let fixture: ComponentFixture<LeafWidget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LeafWidget],
    }).compileComponents();

    fixture = TestBed.createComponent(LeafWidget);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
