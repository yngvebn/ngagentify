import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrokenCard } from './broken-card';

describe('BrokenCard', () => {
  let component: BrokenCard;
  let fixture: ComponentFixture<BrokenCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BrokenCard],
    }).compileComponents();

    fixture = TestBed.createComponent(BrokenCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
