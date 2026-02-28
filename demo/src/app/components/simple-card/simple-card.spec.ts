import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SimpleCard } from './simple-card';

describe('SimpleCard', () => {
  let component: SimpleCard;
  let fixture: ComponentFixture<SimpleCard>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SimpleCard],
    }).compileComponents();

    fixture = TestBed.createComponent(SimpleCard);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
