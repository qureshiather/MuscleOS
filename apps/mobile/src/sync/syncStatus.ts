import { formatRelative } from '@/utils/relativeTime';

export type SyncStatusInput = {
  isSyncing: boolean;
  lastError: string | null;
  lastSyncedAt: string | null;
};

/** Plain copy when a manual sync fails. The raw error stays in dev logs. */
export const SYNC_FAILED_TITLE = 'Sync failed';
export const SYNC_FAILED_MESSAGE = "Couldn't sync right now. Check your internet connection and try again.";
export const SYNC_DONE_TITLE = 'Synced';
export const SYNC_DONE_MESSAGE = 'Your workout data is up to date.';

/** The Account screen's tap-to-sync row: in progress, failed, last success, or never synced. */
export function syncStatusLabel(status: SyncStatusInput, now: Date = new Date()): { label: string; failed: boolean } {
  if (status.isSyncing) return { label: 'Syncing…', failed: false };
  if (status.lastError) return { label: 'Sync failed — tap to retry', failed: true };
  if (status.lastSyncedAt) {
    return { label: `Last synced ${formatRelative(status.lastSyncedAt, now)}`, failed: false };
  }
  return { label: 'Not synced yet — tap to sync', failed: false };
}

/** After Data → Sync now finishes: the alert to show, from the sync store's state. */
export function manualSyncResult(lastError: string | null): { title: string; message: string } {
  return lastError
    ? { title: SYNC_FAILED_TITLE, message: SYNC_FAILED_MESSAGE }
    : { title: SYNC_DONE_TITLE, message: SYNC_DONE_MESSAGE };
}
