import { beforeEach, describe, expect, it } from 'vitest';
// The `@react-native-async-storage/async-storage` import inside localStorage.ts is aliased to this
// same mock file at test time (see vitest.config.mts), so this is the one shared in-memory store.
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import type { PersistedActiveWorkout } from './localStorage';
import { getActiveWorkout, setActiveWorkout } from './localStorage';
import { STORAGE_KEYS } from './keys';

/**
 * Exercises the real persist/resume plumbing against the in-memory AsyncStorage harness:
 * the OS can kill the app mid-workout, so the session is mirrored to storage and read back
 * on launch (docs/features/workout-logging.md#persisting-and-resuming).
 */
const snapshot: PersistedActiveWorkout = {
  session: {
    id: 'session_1',
    templateId: 'ppl-push',
    startedAt: '2026-01-01T10:00:00.000Z',
    exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
  },
  restEndTime: 1_700_000_000_000,
  restTotalSeconds: 120,
  restAfter: { exIdx: 0, setIdx: 0 },
  restDurationsBetweenSets: { '0-0': 90 },
};

describe('active workout persistence round-trip', () => {
  beforeEach(() => __resetAsyncStorage());

  it('reads back exactly what was written', async () => {
    await setActiveWorkout(snapshot);
    expect(await getActiveWorkout()).toEqual(snapshot);
  });

  it('returns null when nothing is stored', async () => {
    expect(await getActiveWorkout()).toBeNull();
  });

  it('clears the stored workout when passed null', async () => {
    await setActiveWorkout(snapshot);
    await setActiveWorkout(null);
    expect(await getActiveWorkout()).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.activeWorkout)).toBeNull();
  });

  it('discards a corrupt payload rather than throwing', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.activeWorkout, '{not valid json');
    expect(await getActiveWorkout()).toBeNull();
  });

  it('discards a payload with no exercises array (schema guard)', async () => {
    await AsyncStorage.setItem(STORAGE_KEYS.activeWorkout, JSON.stringify({ session: {} }));
    expect(await getActiveWorkout()).toBeNull();
  });
});
