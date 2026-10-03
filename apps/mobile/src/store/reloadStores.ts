/**
 * Re-read every store that mirrors AsyncStorage, after something rewrote storage underneath the
 * UI (Clear all data, Delete account). Loaded lazily to avoid store import cycles.
 */
export async function reloadAllStores(userId: string | null): Promise<void> {
  const { reloadSyncedStores } = await import('@/sync/merge');
  const { useSubscriptionStore } = await import('@/store/subscriptionStore');
  await Promise.all([reloadSyncedStores(), useSubscriptionStore.getState().load(userId)]);
}
