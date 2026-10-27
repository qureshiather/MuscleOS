import { describe, expect, it } from 'vitest';
import { scrollRegionFloor } from './sheetLayout';

describe('scrollRegionFloor', () => {
  it('keeps the preferred floor when the card has room', () => {
    expect(scrollRegionFloor({ maxHeight: 700, otherContentHeight: 400, preferred: 140 })).toBe(140);
  });

  it('gives up floor so the rest of the card still fits', () => {
    expect(scrollRegionFloor({ maxHeight: 504, otherContentHeight: 400, preferred: 140 })).toBe(104);
  });

  it('never goes negative when the rest alone overflows', () => {
    expect(scrollRegionFloor({ maxHeight: 300, otherContentHeight: 400, preferred: 140 })).toBe(0);
  });
});
