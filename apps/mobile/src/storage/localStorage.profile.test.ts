import { beforeEach, describe, expect, it } from 'vitest';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { getAppSettings, normalizeAppSettings, normalizeProfile } from './localStorage';

describe('normalizeProfile', () => {
  it('keeps the biodata fields', () => {
    expect(normalizeProfile({ weightKg: 82.5, age: 30, sex: 'female' })).toEqual({ weightKg: 82.5, age: 30, sex: 'female' });
  });

  it('drops the removed height and notNatty fields and anything unknown or malformed', () => {
    expect(normalizeProfile({ weightKg: 80, age: 30, heightCm: 180, notNatty: true })).toEqual({ weightKg: 80, age: 30 });
    expect(normalizeProfile({ weightKg: '80', sex: 'other' })).toEqual({});
    expect(normalizeProfile(null)).toEqual({});
    expect(normalizeProfile('nope')).toEqual({});
  });

  it('strips removed fields from a synced payload', () => {
    const settings = normalizeAppSettings({ profile: { weightKg: 90, age: 30, heightCm: 180, notNatty: true } as never });
    expect(settings.profile).toEqual({ weightKg: 90, age: 30 });
  });
});

describe('getAppSettings profile', () => {
  beforeEach(() => __resetAsyncStorage());

  it('strips removed fields from a profile stored by an older build', async () => {
    await AsyncStorage.setItem('muscleos_profile', JSON.stringify({ sex: 'male', age: 41, heightCm: 180, notNatty: true }));
    expect((await getAppSettings()).profile).toEqual({ sex: 'male', age: 41 });
  });
});
