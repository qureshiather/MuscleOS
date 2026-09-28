import { describe, expect, it } from 'vitest';
import {
  bumpUpdatedAtIfNeeded,
  decideEntityApply,
  isEmptyValue,
  mergeAppSettingsPreferLocal,
  mergeExercisePreviousMap,
  mergeStringMap,
} from './mergePolicy';
import { defaultAppSettings } from '@/storage/localStorage';

const OLD = '2026-01-01T00:00:00.000Z';
const NEW = '2026-01-02T00:00:00.000Z';

describe('decideEntityApply', () => {
  it('takes remote when missing locally', () => {
    expect(
      decideEntityApply({ hasLocal: false, isDirty: false, localUpdatedAt: null, remoteUpdatedAt: OLD })
    ).toBe('take_remote');
  });

  it('keeps local when it has pending changes, even against a newer remote', () => {
    expect(
      decideEntityApply({ hasLocal: true, isDirty: true, localUpdatedAt: OLD, remoteUpdatedAt: NEW })
    ).toBe('keep_local');
  });

  it('is last-write-wins when clean, with ties going to local', () => {
    const clean = { hasLocal: true, isDirty: false };
    expect(decideEntityApply({ ...clean, localUpdatedAt: OLD, remoteUpdatedAt: NEW })).toBe('take_remote');
    expect(decideEntityApply({ ...clean, localUpdatedAt: NEW, remoteUpdatedAt: OLD })).toBe('keep_local');
    expect(decideEntityApply({ ...clean, localUpdatedAt: NEW, remoteUpdatedAt: NEW })).toBe('keep_local');
  });

  it('takes remote for a clean local row with no timestamp', () => {
    expect(
      decideEntityApply({ hasLocal: true, isDirty: false, localUpdatedAt: null, remoteUpdatedAt: OLD })
    ).toBe('take_remote');
  });
});

describe('bumpUpdatedAtIfNeeded', () => {
  it('bumps to now only when the remote is newer', () => {
    expect(bumpUpdatedAtIfNeeded(OLD, NEW, 'NOW')).toBe('NOW');
    expect(bumpUpdatedAtIfNeeded(NEW, OLD, 'NOW')).toBe(NEW);
  });
});

describe('map merges', () => {
  it('unions note keys; non-empty local wins, blank local fills from remote', () => {
    expect(
      mergeStringMap({ a: 'mine', b: '  ', c: 'only local' }, { a: 'theirs', b: 'remote b', d: 'only remote' })
    ).toEqual({ a: 'mine', b: 'remote b', c: 'only local', d: 'only remote' });
  });

  it('unions previous snapshots; local wins per exercise', () => {
    expect(
      mergeExercisePreviousMap(
        { bench: { weightKg: 80, reps: 5 } },
        { bench: { weightKg: 100, reps: 5 }, squat: { weightKg: 120, reps: 3 } }
      )
    ).toEqual({ bench: { weightKg: 80, reps: 5 }, squat: { weightKg: 120, reps: 3 } });
  });

  it('keeps local settings and merges biodata field by field', () => {
    const local = { ...defaultAppSettings(), weightUnit: 'lb' as const, profile: { weightKg: 80 } };
    const remote = {
      ...defaultAppSettings(),
      weightUnit: 'kg' as const,
      themePreference: 'dark' as const,
      profile: { weightKg: 70, sex: 'female' as const },
    };
    const merged = mergeAppSettingsPreferLocal(local, remote);
    expect(merged.weightUnit).toBe('lb');
    expect(merged.themePreference).toBe(local.themePreference);
    expect(merged.profile).toEqual({ weightKg: 80, sex: 'female' });
  });

  it('treats null, blank strings, empty arrays and objects as empty', () => {
    for (const v of [null, undefined, '', '  ', [], {}]) expect(isEmptyValue(v)).toBe(true);
    for (const v of [0, false, 'x', [1], { a: 1 }]) expect(isEmptyValue(v)).toBe(false);
  });
});
