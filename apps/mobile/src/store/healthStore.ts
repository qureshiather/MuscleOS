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
