import { beforeEach, describe, expect, it } from 'vitest';
import AsyncStorage, { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import { getAppSettings, normalizeAppSettings, normalizeProfile } from './localStorage';

describe('normalizeProfile', () => {
  it('keeps the biodata fields', () => {
    expect(normalizeProfile({ heightCm: 180, weightKg: 82.5, age: 30, sex: 'female' })).toEqual({
      heightCm: 180,
      weightKg: 82.5,
      age: 30,
      sex: 'female',
    });
  });

  it('drops the removed notNatty flag and anything unknown or malformed', () => {
    expect(normalizeProfile({ age: 30, notNatty: true, sex: 'other', heightCm: '180' })).toEqual({
      age: 30,
    });
    expect(normalizeProfile(null)).toEqual({});
    expect(normalizeProfile('nope')).toEqual({});
  });

  it('strips notNatty from a synced payload', () => {
    const settings = normalizeAppSettings({ profile: { weightKg: 90, notNatty: true } as never });
    expect(settings.profile).toEqual({ weightKg: 90 });
  });
});

describe('getAppSettings profile', () => {
  beforeEach(() => __resetAsyncStorage());

  it('strips notNatty from a profile stored by an older build', async () => {
    await AsyncStorage.setItem('muscleos_profile', JSON.stringify({ age: 41, notNatty: true }));
    expect((await getAppSettings()).profile).toEqual({ age: 41 });
  });
});
