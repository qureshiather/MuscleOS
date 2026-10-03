import { beforeEach, describe, expect, it } from 'vitest';
import { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { getHealth } from '@/storage/localStorage';
import { computeBMR, computeMacros, computeTDEE, useHealthStore } from './healthStore';

/** docs/features/accounts-and-data.md#health — Mifflin-St Jeor scaffolding (no UI). */

describe('computeBMR (Mifflin-St Jeor)', () => {
  it('male: 10w + 6.25h − 5a + 5', () => {
    expect(computeBMR(80, 180, 30, 'male')).toBe(1780);
  });
  it('female: 10w + 6.25h − 5a − 161', () => {
    expect(computeBMR(60, 165, 30, 'female')).toBe(1320.25);
  });
});

describe('computeTDEE', () => {
  it('applies the activity multiplier and rounds', () => {
    expect(computeTDEE(1780, 'sedentary')).toBe(2136);
    expect(computeTDEE(1780, 'light')).toBe(2448);
    expect(computeTDEE(1780, 'moderate')).toBe(2759);
    expect(computeTDEE(1780, 'active')).toBe(3071);
    expect(computeTDEE(1780, 'very_active')).toBe(3382);
  });
});

describe('computeMacros', () => {
  it('maintain: TDEE calories, 1.6 g/kg protein, 25% fat, rest carbs', () => {
    expect(computeMacros(2500, 'maintain', 80)).toEqual({ caloriesKcal: 2500, proteinG: 128, carbsG: 342, fatG: 69 });
  });
  it('lose −500, gain +300 with 2.2 g/kg protein', () => {
    expect(computeMacros(2500, 'lose', 80).caloriesKcal).toBe(2000);
    expect(computeMacros(2500, 'gain', 80)).toMatchObject({ caloriesKcal: 2800, proteinG: 176 });
  });
  it('floors calories at 1200, protein at 50 g, fat at 20 g (carbs come from the unfloored figure)', () => {
    expect(computeMacros(900, 'lose', 20)).toEqual({ caloriesKcal: 1200, proteinG: 50, carbsG: 43, fatG: 20 });
  });
});

describe('useHealthStore', () => {
  beforeEach(() => __resetAsyncStorage());

  it('persists targets and metabolism locally (never synced) and loads them back', async () => {
    await useHealthStore.getState().setMacroTargets({ caloriesKcal: 2000 } as never);
    await useHealthStore.getState().setMetabolism({ bmrKcal: 1700 } as never);
    expect(await getHealth()).toEqual({ macroTargets: { caloriesKcal: 2000 }, metabolism: { bmrKcal: 1700 } });
    useHealthStore.setState({ macroTargets: null, metabolism: null });
    await useHealthStore.getState().load();
    expect(useHealthStore.getState()).toMatchObject({ macroTargets: { caloriesKcal: 2000 }, isLoading: false });
  });
});
