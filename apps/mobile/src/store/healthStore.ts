import { create } from 'zustand';
import type { MacroTargets, MetabolismInfo } from '@muscleos/types';
import { getHealth, setHealth } from '@/storage/localStorage';

export interface HealthState {
  macroTargets: MacroTargets | null;
  metabolism: MetabolismInfo | null;
  isLoading: boolean;
  load: () => Promise<void>;
  setMacroTargets: (t: MacroTargets) => Promise<void>;
  setMetabolism: (m: MetabolismInfo) => Promise<void>;
}

export const useHealthStore = create<HealthState>((set, get) => ({
  macroTargets: null,
  metabolism: null,
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const data = await getHealth();
    set({
      macroTargets: data.macroTargets ?? null,
      metabolism: data.metabolism ?? null,
      isLoading: false,
    });
  },

  setMacroTargets: async (macroTargets) => {
    const data = await getHealth();
    await setHealth({ ...data, macroTargets });
    set({ macroTargets });
  },

  setMetabolism: async (metabolism) => {
    const data = await getHealth();
    await setHealth({ ...data, metabolism });
    set({ metabolism });
  },
}));

/** Mifflin-St Jeor BMR estimate (kcal/day) */
export function computeBMR(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  if (sex === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type MacroGoal = 'maintain' | 'lose' | 'gain';

const ACTIVITY_MULT: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** TDEE from BMR and activity */
export function computeTDEE(bmrKcal: number, activity: ActivityLevel): number {
  return Math.round(bmrKcal * ACTIVITY_MULT[activity]);
}

/** Suggested macro targets from TDEE, goal, and weight. You can adjust after. */
export function computeMacros(
  tdeeKcal: number,
  goal: MacroGoal,
  weightKg: number
): { caloriesKcal: number; proteinG: number; carbsG: number; fatG: number } {
  const calorieDelta = goal === 'lose' ? -500 : goal === 'gain' ? 300 : 0;
  const caloriesKcal = Math.round(tdeeKcal + calorieDelta);
  const proteinG = Math.round(goal === 'gain' ? weightKg * 2.2 : weightKg * 1.6);
  const fatG = Math.round((caloriesKcal * 0.25) / 9);
  const carbsG = Math.round((caloriesKcal - proteinG * 4 - fatG * 9) / 4);
  return {
    caloriesKcal: Math.max(1200, caloriesKcal),
    proteinG: Math.max(50, proteinG),
    carbsG: Math.max(0, carbsG),
    fatG: Math.max(20, fatG),
  };
}
