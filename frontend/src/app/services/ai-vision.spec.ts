import { TestBed } from '@angular/core/testing';

import { AiVision } from './ai-vision';

describe('AiVision', () => {
  let service: AiVision;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiVision);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
