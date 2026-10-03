import { useExercisesStore } from '@/store/exercisesStore';
import { useSessionsStore } from '@/store/sessionsStore';
import { useTemplatesStore } from '@/store/templatesStore';
import { useRecoveryStore } from '@/store/recoveryStore';
import { useExerciseNotesStore } from '@/store/exerciseNotesStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';

/**
 * Re-read the stores that mirror synced data, after something rewrote storage underneath the UI.
 * Exercises first: recovery needs custom exercises to resolve muscles. (Screens only — the sync
 * engine uses `reloadSyncedStores` in sync/merge.ts, which imports lazily to avoid store cycles.)
 */
export async function reloadDataStores(): Promise<void> {
  await useExercisesStore.getState().load();
  await Promise.all([
    useSessionsStore.getState().load(),
    useTemplatesStore.getState().load(),
    useRecoveryStore.getState().load(),
    useExerciseNotesStore.getState().load(),
    useSettingsStore.getState().load(),
  ]);
}

/**
 * Every store that mirrors AsyncStorage, plus the subscription tier — after Clear all data or
 * Delete account. The in-progress workout is not cleared by either reset path's store reload: Clear
 * all data keeps it, and Delete account discards it in the auth store.
 */
export async function reloadAllStores(userId: string | null): Promise<void> {
  await Promise.all([reloadDataStores(), useSubscriptionStore.getState().load(userId)]);
}
