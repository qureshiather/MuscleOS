import { describe, expect, it } from 'vitest';
import { cropToRegions, pickFigureSide } from './bodyCrop';

describe('pickFigureSide', () => {
  it('shows the front for push muscles and the back for pull and posterior chain', () => {
    expect(pickFigureSide(['chest', 'deltoids', 'triceps'], 'male')).toBe('front');
    expect(pickFigureSide(['upper-back', 'biceps', 'trapezius', 'lower-back'], 'male')).toBe('back');
    expect(pickFigureSide(['quadriceps', 'hamstring', 'gluteal', 'calves'], 'male')).toBe('back');
    expect(pickFigureSide(['quadriceps'], 'female')).toBe('front');
  });
});

describe('cropToRegions', () => {
  it('matches the requested aspect and contains every lit region', () => {
    const { side, viewBox } = cropToRegions(['chest', 'deltoids', 'triceps'], 'male', 1.2);
    const [x, y, w, h] = viewBox;
    expect(side).toBe('front');
    expect(w / h).toBeCloseTo(1.2);
    // Deltoids span 193–543 × 296–398; chest reaches down to 438.
    expect(x).toBeLessThan(193);
    expect(x + w).toBeGreaterThan(543);
    expect(y).toBeLessThan(296);
    expect(y + h).toBeGreaterThan(438);
  });

  it('keeps a minimum height so a single small region is not over-zoomed', () => {
    const { viewBox } = cropToRegions(['trapezius'], 'male', 1);
    expect(viewBox[3]).toBeGreaterThanOrEqual(360);
  });

  it('falls back to a front torso crop when nothing is lit', () => {
    const { side, viewBox } = cropToRegions([], 'female', 1);
    expect(side).toBe('front');
    expect(viewBox[1]).toBeLessThan(434);
  });

  it('crops legs low on the figure', () => {
    const { viewBox } = cropToRegions(['quadriceps', 'hamstring', 'gluteal', 'calves'], 'male', 0.9);
    expect(viewBox[1]).toBeGreaterThan(400);
  });
});
