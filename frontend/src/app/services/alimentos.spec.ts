import { TestBed } from '@angular/core/testing';

import { Alimentos } from './alimentos';

describe('Alimentos', () => {
  let service: Alimentos;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Alimentos);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
