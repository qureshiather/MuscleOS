import { create } from 'zustand';
import { getExerciseNotes, setExerciseNotes } from '@/storage/localStorage';
import { notifyExerciseNotesSnapshot } from '@/sync';

export interface ExerciseNotesStoreState {
  notes: Record<string, string>;
  isLoading: boolean;
  load: () => Promise<void>;
  getNote: (exerciseId: string) => string;
  setNote: (exerciseId: string, note: string) => Promise<void>;
}

export const useExerciseNotesStore = create<ExerciseNotesStoreState>((set, get) => ({
  notes: {},
  isLoading: true,

  load: async () => {
    set({ isLoading: true });
    const notes = await getExerciseNotes();
    set({ notes, isLoading: false });
  },

  getNote: (exerciseId) => get().notes[exerciseId] ?? '',

  setNote: async (exerciseId, note) => {
    const trimmed = note.trim();
    const { notes } = get();
    const next = { ...notes };
    if (trimmed) {
      next[exerciseId] = trimmed;
    } else {
      delete next[exerciseId];
    }
    await setExerciseNotes(next);
    set({ notes: next });
    notifyExerciseNotesSnapshot(next);
  },
}));
