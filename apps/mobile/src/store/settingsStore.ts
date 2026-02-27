import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WeightUnit } from '@/utils/weightUnits';

const WEIGHT_UNIT_KEY = 'muscleos_weight_unit';

export interface SettingsState {
  weightUnit: WeightUnit;
  isLoading: boolean;
  load: () => Promise<void>;
  setWeightUnit: (unit: WeightUnit) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  weightUnit: 'kg',
  isLoading: true,

  load: async () => {
    try {
      const stored = await AsyncStorage.getItem(WEIGHT_UNIT_KEY);
      set({
        weightUnit: stored === 'lb' ? 'lb' : 'kg',
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  setWeightUnit: async (unit) => {
    set({ weightUnit: unit });
    await AsyncStorage.setItem(WEIGHT_UNIT_KEY, unit);
  },
}));
