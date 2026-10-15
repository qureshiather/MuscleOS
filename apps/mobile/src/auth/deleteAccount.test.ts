import { beforeEach, describe, expect, it, vi } from 'vitest';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { STORAGE_KEYS } from '@/storage/keys';
import { setActiveWorkout } from '@/storage/localStorage';
import { getAppleAuthorizationCode, setAppleAuthorizationCode } from '@/auth/appleAuthCode';
import {
  type AccountDeletionResetDeps,
  resetDeviceAfterAccountDeletion,
  startFreshAnonymousGuest,
  wipeDeviceAfterAccountDeletion,
} from '@/auth/deleteAccount';

describe('account deletion local reset', () => {
  beforeEach(() => __resetAsyncStorage());

  it('wipes workouts, sync transport, biodata, and the Apple authorization code', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEYS.sessions,
      JSON.stringify([
        {
          id: 'session_del_1',
          templateId: 'ppl-push',
          startedAt: '2026-01-01T10:00:00.000Z',
          exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
        },
      ])
    );
    await AsyncStorage.setItem(
      STORAGE_KEYS.templates,
      JSON.stringify([{ id: 'tpl_custom_1', name: 'My Push', exerciseIds: ['bench-press'] }])
    );
    await setActiveWorkout({
      session: {
        id: 'session_del_1',
        templateId: 'ppl-push',
        startedAt: '2026-01-01T10:00:00.000Z',
        exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
      },
      restEndTime: 1_700_000_000_000,
      restTotalSeconds: 120,
      restAfter: { exIdx: 0, setIdx: 0 },
      restDurationsBetweenSets: {},
    });
    await AsyncStorage.setItem(STORAGE_KEYS.syncOutbox, '[{"id":"1"}]');
    await AsyncStorage.setItem(STORAGE_KEYS.syncMeta, '{"pulledAt":1}');
    await AsyncStorage.setItem('muscleos_profile', '{"age":30}');
    await setAppleAuthorizationCode('apple-auth-code');

    await wipeDeviceAfterAccountDeletion();

    expect(await AsyncStorage.getItem(STORAGE_KEYS.sessions)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.templates)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.activeWorkout)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.syncOutbox)).toBeNull();
    expect(await AsyncStorage.getItem(STORAGE_KEYS.syncMeta)).toBeNull();
    expect(await AsyncStorage.getItem('muscleos_profile')).toBeNull();
    expect(await getAppleAuthorizationCode()).toBeNull();
  });

  it('starts a fresh anonymous guest', async () => {
    const user = await startFreshAnonymousGuest({
      signInAnonymously: async () => ({ user: { id: 'anon_new' } }),
    });
    expect(user).toEqual({ id: 'anon_new' });
  });

  it('returns null when anonymous sign-in returns no user', async () => {
    const user = await startFreshAnonymousGuest({ signInAnonymously: async () => ({ user: null }) });
    expect(user).toBeNull();
  });
});

describe('resetDeviceAfterAccountDeletion', () => {
  function deps(overrides: Partial<AccountDeletionResetDeps<{ id: string }>> = {}) {
    const calls: string[] = [];
    const step = (name: string) => async () => {
      calls.push(name);
    };
    return {
      calls,
      deps: {
        signOutGoogle: step('google'),
        signOutSupabase: step('supabase'),
        discardActiveWorkout: () => {
          calls.push('workout');
        },
        wipeDevice: step('wipe'),
        signInAnonymously: async () => {
          calls.push('guest');
          return { user: { id: 'anon_new' } };
        },
        resetSyncTransport: async (userId: string | null) => {
          calls.push(`sync:${userId}`);
        },
        ...overrides,
      } satisfies AccountDeletionResetDeps<{ id: string }>,
    };
  }

  it('signs out, wipes, starts a guest and points sync at it, in order', async () => {
    const { calls, deps: d } = deps();
    expect(await resetDeviceAfterAccountDeletion(d)).toEqual({ id: 'anon_new' });
    expect(calls).toEqual(['google', 'supabase', 'workout', 'wipe', 'guest', 'sync:anon_new']);
  });

  it('keeps going when a step throws: the account is already gone', async () => {
    const wipeDevice = vi.fn(async () => undefined);
    const { deps: d } = deps({
      signOutSupabase: async () => {
        throw new Error('User from sub claim in JWT does not exist');
      },
      discardActiveWorkout: () => {
        throw new Error('boom');
      },
      wipeDevice,
    });
    expect(await resetDeviceAfterAccountDeletion(d)).toEqual({ id: 'anon_new' });
    expect(wipeDevice).toHaveBeenCalledTimes(1);
  });

  it('ends as a local-only guest when anonymous sign-in throws', async () => {
    const { calls, deps: d } = deps({
      signInAnonymously: async () => {
        throw new Error('Anonymous sign-ins are disabled');
      },
    });
    expect(await resetDeviceAfterAccountDeletion(d)).toBeNull();
    expect(calls.at(-1)).toBe('sync:null');
  });
});
