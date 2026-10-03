import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Exercise notes (docs/features/exercise-library.md#exercises-tab, "Your notes"). */

vi.mock('@/sync', () => ({ notifyExerciseNotesSnapshot: vi.fn() }));

async function load() {
  vi.resetModules();
  const AsyncStorage = (await import('@/test/mocks/asyncStorage')).default;
  const { STORAGE_KEYS } = await import('@/storage/keys');
  const sync = await import('@/sync');
  const { useExerciseNotesStore } = await import('./exerciseNotesStore');
  return { AsyncStorage, STORAGE_KEYS, sync, useExerciseNotesStore };
}

beforeEach(async () => {
  vi.clearAllMocks();
  const { __resetAsyncStorage } = await import('@/test/mocks/asyncStorage');
  __resetAsyncStorage();
});

describe('exerciseNotesStore', () => {
  it('loads notes keyed by exercise id', async () => {
    const { useExerciseNotesStore, AsyncStorage, STORAGE_KEYS } = await load();
    await AsyncStorage.setItem(STORAGE_KEYS.exerciseNotes, JSON.stringify({ 'leg-press': 'seat 4' }));
    await useExerciseNotesStore.getState().load();
    expect(useExerciseNotesStore.getState().isLoading).toBe(false);
    expect(useExerciseNotesStore.getState().getNote('leg-press')).toBe('seat 4');
    expect(useExerciseNotesStore.getState().getNote('unknown')).toBe('');
  });

  it('trims, persists and pushes the full notes snapshot', async () => {
    const { useExerciseNotesStore, AsyncStorage, STORAGE_KEYS, sync } = await load();
    await useExerciseNotesStore.getState().load();
    await useExerciseNotesStore.getState().setNote('leg-press', '  seat 4  ');
    await useExerciseNotesStore.getState().setNote('bench-press', 'arch');

    const expected = { 'leg-press': 'seat 4', 'bench-press': 'arch' };
    expect(useExerciseNotesStore.getState().notes).toEqual(expected);
    expect(JSON.parse((await AsyncStorage.getItem(STORAGE_KEYS.exerciseNotes)) ?? '{}')).toEqual(expected);
    expect(sync.notifyExerciseNotesSnapshot).toHaveBeenLastCalledWith(expected);
  });

  it('deletes the entry when the note is blank after trimming', async () => {
    const { useExerciseNotesStore, sync } = await load();
    await useExerciseNotesStore.getState().load();
    await useExerciseNotesStore.getState().setNote('leg-press', 'seat 4');
    await useExerciseNotesStore.getState().setNote('leg-press', '   ');
    expect(useExerciseNotesStore.getState().notes).toEqual({});
    expect(sync.notifyExerciseNotesSnapshot).toHaveBeenLastCalledWith({});
  });

  it('removeNote is a no-op (no write, no sync) when there is no note', async () => {
    const { useExerciseNotesStore, sync } = await load();
    await useExerciseNotesStore.getState().load();
    await useExerciseNotesStore.getState().removeNote('custom_1');
    expect(sync.notifyExerciseNotesSnapshot).not.toHaveBeenCalled();
  });
});
