import { beforeEach, describe, expect, it } from 'vitest';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { STORAGE_KEYS } from '@/storage/keys';
import { setActiveWorkout } from '@/storage/localStorage';
import { getAppleAuthorizationCode, setAppleAuthorizationCode } from '@/auth/appleAuthCode';
import { startFreshAnonymousGuest, wipeDeviceAfterAccountDeletion } from '@/auth/deleteAccount';

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

  it('starts a fresh anonymous guest and re-points RevenueCat at that id', async () => {
    const calls: string[] = [];
    const user = await startFreshAnonymousGuest({
      signInAnonymously: async () => {
        calls.push('anon');
        return { user: { id: 'anon_new' } };
      },
      revenueCatLogOut: async () => {
        calls.push('rc-out');
      },
      revenueCatLogIn: async (userId) => {
        calls.push(`rc-in:${userId}`);
      },
    });

    expect(user).toEqual({ id: 'anon_new' });
    expect(calls).toEqual(['anon', 'rc-out', 'rc-in:anon_new']);
  });

  it('skips RevenueCat when anonymous sign-in returns no user', async () => {
    const calls: string[] = [];
    const user = await startFreshAnonymousGuest({
      signInAnonymously: async () => {
        calls.push('anon');
        return { user: null };
      },
      revenueCatLogOut: async () => {
        calls.push('rc-out');
      },
      revenueCatLogIn: async (userId) => {
        calls.push(`rc-in:${userId}`);
      },
    });

    expect(user).toBeNull();
    expect(calls).toEqual(['anon']);
  });
});
