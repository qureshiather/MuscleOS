import { create } from 'zustand';
import type { Exercise } from '@muscleos/types';
import { getCustomExercises, setCustomExercises } from '@/storage/localStorage';
import { EXERCISES } from '@/data/exercises';

export interface ExercisesStoreState {
  customExercises: Exercise[];
  isLoading: boolean;
  load: () => Promise<void>;
  getExercise: (id: string) => Exercise | undefined;
  /** Built-in + custom (custom last) */
  getAllExercises: () => Exercise[];
  addExercise: (exercise: Omit<Exercise, 'id'>) => Promise<Exercise>;
  updateExercise: (id: string, patch: Partial<Omit<Exercise, 'id'>>) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;
}

function nextCustomId(custom: Exercise[]): string {
  const max = custom.reduce((acc, e) => {
    const m = e.id.match(/^custom_(\d+)$/);
    return m ? Math.max(acc, parseInt(m[1], 10)) : acc;
  }, 0);
  return `custom_${max + 1}`;
}

export const useExercisesStore = create<ExercisesStoreState>((set, get) => ({
  customExercises: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const customExercises = await getCustomExercises();
    set({ customExercises, isLoading: false });
  },

  getExercise: (id) => {
    const builtIn = EXERCISES.find((e) => e.id === id);
    if (builtIn) return builtIn;
    return get().customExercises.find((e) => e.id === id);
  },

  getAllExercises: () => {
    return [...EXERCISES, ...get().customExercises];
  },

  addExercise: async (exercise) => {
    const { customExercises } = get();
    const id = nextCustomId(customExercises);
    const newEx: Exercise = { ...exercise, id };
    const next = [...customExercises, newEx];
    await setCustomExercises(next);
    set({ customExercises: next });
    return newEx;
  },

  updateExercise: async (id, patch) => {
    const { customExercises } = get();
    const next = customExercises.map((e) => (e.id === id ? { ...e, ...patch } : e));
    await setCustomExercises(next);
    set({ customExercises: next });
  },

  removeExercise: async (id) => {
    const { customExercises } = get();
    const next = customExercises.filter((e) => e.id !== id);
    await setCustomExercises(next);
    set({ customExercises: next });
  },
}));
