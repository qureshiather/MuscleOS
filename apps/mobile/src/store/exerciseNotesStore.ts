import { create } from 'zustand';
import { getExerciseNotes, setExerciseNotes } from '@/storage/localStorage';
import { notifyExerciseNotesSnapshot } from '@/sync';

export interface ExerciseNotesStoreState {
  notes: Record<string, string>;
  isLoading: boolean;
  load: () => Promise<void>;
  getNote: (exerciseId: string) => string;
  /** Notes are trimmed; an empty note deletes the entry. Every change pushes a full snapshot. */
  setNote: (exerciseId: string, note: string) => Promise<void>;
  /** Drop an exercise's note (used when a custom exercise is deleted). No-op when there is none. */
  removeNote: (exerciseId: string) => Promise<void>;
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

  removeNote: async (exerciseId) => {
    // Notes may not be loaded yet; writing from the empty initial state would wipe storage.
    if (get().isLoading) await get().load();
    if (!(exerciseId in get().notes)) return;
    await get().setNote(exerciseId, '');
  },
}));
