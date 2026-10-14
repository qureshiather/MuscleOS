import { describe, expect, it } from 'vitest';
import { formatTick, valueAxis } from './chartAxis';

describe('valueAxis', () => {
  it('hugs the data with round ticks instead of starting at zero', () => {
    // Overhead press in lb from the MUS-142 report: 107.7 → 117.2.
    const axis = valueAxis([107.7, 110.8, 117.2]);
    expect(axis.min).toBeGreaterThan(100);
    expect(axis.min).toBeLessThanOrEqual(107.7);
    expect(axis.max).toBeGreaterThanOrEqual(117.2);
    expect(axis.ticks[0]).toBe(axis.min);
    expect(axis.ticks.at(-1)).toBe(axis.max);
    expect(axis.ticks).toEqual([105, 110, 115, 120]);
  });

  it('spaces ticks evenly on 1 / 2 / 2.5 / 5 steps', () => {
    expect(valueAxis([0, 100]).ticks).toEqual([0, 50, 100]);
    expect(valueAxis([60, 140]).ticks).toEqual([50, 100, 150]);
    expect(valueAxis([1, 2]).ticks).toEqual([1, 1.5, 2]);
  });

  it('gives a flat series a band around its value', () => {
    const axis = valueAxis([80]);
    expect(axis.min).toBeLessThan(80);
    expect(axis.max).toBeGreaterThan(80);
  });

  it('falls back to 0–1 with no values', () => {
    expect(valueAxis([])).toEqual({ min: 0, max: 1, ticks: [0, 1] });
  });
});

describe('formatTick', () => {
  it('drops trailing zeros and keeps one decimal at most', () => {
    expect(formatTick(110)).toBe('110');
    expect(formatTick(112.5)).toBe('112.5');
    expect(formatTick(0.30000000000000004)).toBe('0.3');
  });
});
