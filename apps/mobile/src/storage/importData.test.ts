import type { WorkoutSession } from '@muscleos/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetAsyncStorage } from '@/test/mocks/asyncStorage';
import {
  getCustomExercises,
  getExerciseNotes,
  getExercisePrevious,
  getRecovery,
  getSessions,
  getTemplates,
  setExerciseNotes,
  setSessions,
} from './localStorage';
import type { ImportPlan } from './importPlan';

/**
 * docs/features/accounts-and-data.md#import — `applyImport` writes, derived rebuilds, and the
 * outbox (A27: a guest's import queues nothing).
 */

const sync = vi.hoisted(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  return { enabled: false, schedulePush: vi.fn() };
});
vi.mock('expo-document-picker', () => ({ getDocumentAsync: vi.fn() }));
vi.mock('expo-file-system/legacy', () => ({ readAsStringAsync: vi.fn(), EncodingType: { UTF8: 'utf8' } }));
vi.mock('@/sync', () => ({
  isCloudSyncEnabled: () => sync.enabled,
  schedulePush: sync.schedulePush,
  notifyCustomExerciseUpsert: vi.fn(),
  notifyCustomExerciseDelete: vi.fn(),
}));
vi.mock('@/sync/merge', () => ({ reloadSyncedStores: vi.fn(async () => undefined) }));
vi.mock('@/sync/catalogPull', () => ({
  fetchCatalogDelta: vi.fn(async (watermark: string) => ({ exercises: [], watermark })),
}));

const { applyImport } = await import('./importData');
const { getOutbox } = await import('@/sync/outbox');
const { reloadSyncedStores } = await import('@/sync/merge');

const NOW = '2026-03-01T12:00:00.000Z';
const session = (id: string, completedAt: string, weightKg: number): WorkoutSession => ({
  id,
  templateId: 'ppl-push',
  startedAt: completedAt,
  completedAt,
  exercises: [{ exerciseId: 'bench-press', sets: [{ completed: true, weightKg, reps: 5 }] }],
});

const plan: ImportPlan = {
  sessions: [session('imported', '2026-02-01T10:00:00.000Z', 100)],
  templates: [{ id: 'tpl-imported', name: 'Imported', exerciseIds: ['bench-press'] }],
  templateFolders: [{ id: 'fold-imported', name: 'Folder' }],
  customExercises: [{ id: 'custom_9', name: 'Mine', muscles: ['chest'], equipment: [], category: 'free_weight' } as never],
  exerciseNotes: { squat: 'Imported note' },
};

beforeEach(async () => {
  __resetAsyncStorage();
  sync.enabled = false;
  sync.schedulePush.mockClear();
  vi.mocked(reloadSyncedStores).mockClear();
  await setSessions([session('local', '2026-01-01T10:00:00.000Z', 60)]);
  await setExerciseNotes({ bench: 'Local note' });
});

describe('applyImport', () => {
  it('adds the planned rows without touching local ones', async () => {
    await applyImport(plan, () => NOW);
    expect((await getSessions()).map((s) => s.id)).toEqual(['local', 'imported']);
    expect((await getTemplates()).map((t) => t.id)).toEqual(['tpl-imported']);
    expect((await getCustomExercises()).map((e) => e.id)).toEqual(['custom_9']);
    expect(await getExerciseNotes()).toEqual({ bench: 'Local note', squat: 'Imported note' });
  });

  it('rebuilds previous from all sessions and recomputes recovery', async () => {
    await applyImport(plan, () => NOW);
    expect((await getExercisePrevious())['bench-press']).toMatchObject({ weightKg: 100, reps: 5 });
    expect((await getRecovery()).length).toBeGreaterThan(0);
    expect(reloadSyncedStores).toHaveBeenCalled();
    expect(sync.schedulePush).toHaveBeenCalledWith(0);
  });

  it('a guest import queues nothing for upload (A27)', async () => {
    await applyImport(plan, () => NOW);
    expect(await getOutbox()).toEqual([]);
  });

  it('a linked account queues every imported row plus previous and notes snapshots', async () => {
    sync.enabled = true;
    await applyImport(plan, () => NOW);
    const keys = (await getOutbox()).map((e) => `${e.entityType}:${e.entityId}`);
    expect(keys).toEqual([
      'session:imported',
      'template:tpl-imported',
      'template_folder:fold-imported',
      'custom_exercise:custom_9',
      'exercise_previous:default',
      'exercise_note:default',
    ]);
    const notes = (await getOutbox()).find((e) => e.entityType === 'exercise_note');
    expect(notes?.payload).toEqual({ bench: 'Local note', squat: 'Imported note' });
  });
});
