import { create } from 'zustand';
import type { WorkoutTemplate } from '@muscleos/types';
import { getTemplates, setTemplates } from '@/storage/localStorage';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';

export interface TemplatesState {
  userTemplates: WorkoutTemplate[];
  isLoading: boolean;
  load: () => Promise<void>;
  addTemplate: (t: WorkoutTemplate) => Promise<void>;
  updateTemplate: (id: string, t: Partial<WorkoutTemplate>) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
  /** All templates = built-in + user (built-in first) */
  allTemplates: () => WorkoutTemplate[];
}

export const useTemplatesStore = create<TemplatesState>((set, get) => ({
  userTemplates: [],
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const userTemplates = await getTemplates();
    set({ userTemplates, isLoading: false });
  },

  addTemplate: async (t) => {
    const { userTemplates } = get();
    const next = [...userTemplates, t];
    await setTemplates(next);
    set({ userTemplates: next });
  },

  updateTemplate: async (id, patch) => {
    const { userTemplates } = get();
    const next = userTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t));
    await setTemplates(next);
    set({ userTemplates: next });
  },

  deleteTemplate: async (id) => {
    const { userTemplates } = get();
    const next = userTemplates.filter((t) => t.id !== id);
    await setTemplates(next);
    set({ userTemplates: next });
  },

  allTemplates: () => {
    const { userTemplates } = get();
    return [...BUILT_IN_TEMPLATES, ...userTemplates];
  },
}));
