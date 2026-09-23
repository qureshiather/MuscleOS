import { describe, expect, it } from 'vitest';
import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  formatHeight,
  formatWeight,
  kgToDisplay,
} from './weightUnits';

describe('weightUnits', () => {
  it('round-trips kg display values', () => {
    expect(kgToDisplay(82.55, 'kg')).toBe(82.55);
    expect(kgToDisplay(20.25, 'kg')).toBe(20.25);
    expect(displayToKg(82.6, 'kg')).toBe(82.6);
    expect(formatWeight(82.5, 'kg')).toBe('82.5 kg');
    expect(formatWeight(20.25, 'kg')).toBe('20.25 kg');
  });

  it('keeps 2.5 lb plate steps stable through kg storage', () => {
    for (const pounds of [2.5, 45, 97.5, 135, 137.5, 225]) {
      expect(kgToDisplay(displayToKg(pounds, 'lb'), 'lb')).toBe(pounds);
    }
  });

  it('converts kg to lb for display and back for storage', () => {
    expect(kgToDisplay(80, 'lb')).toBe(176.4);
    expect(displayToKg(176.4, 'lb')).toBe(80.01);
    expect(formatWeight(80, 'lb')).toBe('176.4 lb');
  });

  it('converts height between cm and inches', () => {
    expect(cmToDisplay(175, 'cm')).toBe(175);
    expect(cmToDisplay(175, 'in')).toBe(68.9);
    expect(displayToCm(68.9, 'in')).toBe(175.01);
    expect(formatHeight(175, 'in')).toBe('68.9 in');
  });
});
