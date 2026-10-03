import { describe, expect, it } from 'vitest';
import { manualSyncResult, syncStatusLabel } from './syncStatus';

/** docs/features/accounts-and-data.md — the Account sync row and Data → Sync now result. */

const NOW = new Date('2026-03-01T12:00:00.000Z');

describe('syncStatusLabel', () => {
  it('shows progress first', () => {
    expect(syncStatusLabel({ isSyncing: true, lastError: 'x', lastSyncedAt: null }, NOW)).toEqual({
      label: 'Syncing…',
      failed: false,
    });
  });

  it('shows a failure over an older success', () => {
    expect(
      syncStatusLabel({ isSyncing: false, lastError: 'Network', lastSyncedAt: '2026-03-01T11:00:00.000Z' }, NOW)
    ).toEqual({ label: 'Sync failed — tap to retry', failed: true });
  });

  it('shows the last success relative to now', () => {
    expect(
      syncStatusLabel({ isSyncing: false, lastError: null, lastSyncedAt: '2026-03-01T11:55:00.000Z' }, NOW).label
    ).toBe('Last synced 5 min ago');
  });

  it('asks to sync when it never has', () => {
    expect(syncStatusLabel({ isSyncing: false, lastError: null, lastSyncedAt: null }, NOW).label).toBe(
      'Not synced yet — tap to sync'
    );
  });
});

describe('manualSyncResult', () => {
  it('says Synced only when the sync store has no error', () => {
    expect(manualSyncResult(null)).toEqual({ title: 'Synced', message: 'Your workout data is up to date.' });
    expect(manualSyncResult('upsert failed: JWT expired')).toEqual({
      title: 'Sync failed',
      message: "Couldn't sync right now. Check your internet connection and try again.",
    });
  });
});
