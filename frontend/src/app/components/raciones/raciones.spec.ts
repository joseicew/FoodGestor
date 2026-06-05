import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Raciones } from './raciones';

describe('Raciones', () => {
  let component: Raciones;
  let fixture: ComponentFixture<Raciones>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Raciones],
    }).compileComponents();

    fixture = TestBed.createComponent(Raciones);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
