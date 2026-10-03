import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-file-system/legacy', () => ({}));
vi.mock('expo-sharing', () => ({}));
vi.mock('@/store/authStore', () => ({ useAuthStore: { getState: () => ({ profile: null }) } }));

import { exportFilename } from './exportData';

describe('exportFilename', () => {
  it('uses the local calendar date', () => {
    expect(exportFilename(new Date(2026, 8, 7, 12))).toBe('muscleos-export-2026-09-07.json');
  });

  it('uses the local date either side of local midnight, not the UTC date', () => {
    // 00:30 local on 7 Sep is still 6 Sep in UTC in any zone ahead of UTC (and 23:30 on 6 Sep is
    // already 7 Sep in UTC behind it); the name follows the device's calendar either way.
    expect(exportFilename(new Date(2026, 8, 7, 0, 30))).toBe('muscleos-export-2026-09-07.json');
    expect(exportFilename(new Date(2026, 8, 6, 23, 30))).toBe('muscleos-export-2026-09-06.json');
  });
});
