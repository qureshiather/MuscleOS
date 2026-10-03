import type { WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { type ImportPlan, importConfirmMessage, importFailureMessage, importOutboxEntries } from './importPlan';

/** docs/features/accounts-and-data.md#import — dialog copy and what an import queues for upload. */

const NOW = '2026-03-01T12:00:00.000Z';
const session = (id: string, completedAt?: string): WorkoutSession => ({
  id,
  templateId: 'ppl-push',
  startedAt: '2026-01-01T10:00:00.000Z',
  ...(completedAt ? { completedAt } : {}),
  exercises: [],
});
const emptyPlan: ImportPlan = { sessions: [], templates: [], templateFolders: [], customExercises: [], exerciseNotes: {} };

describe('import copy', () => {
  it('explains a file that is not an export, and one from another version', () => {
    expect(importFailureMessage('invalid')).toBe('Choose a file made with Export my data in MuscleOS.');
    expect(importFailureMessage('unsupported_version')).toBe(
      'This export is from a different version of MuscleOS. Update the app and try again.'
    );
  });

  it('names what will be added, and says it backs up only when signed in', () => {
    expect(importConfirmMessage('2 workouts', false)).toBe(
      'Add 2 workouts to this device? Nothing already here is changed or removed.'
    );
    expect(importConfirmMessage('2 workouts', true)).toBe(
      'Add 2 workouts to this device? Nothing already here is changed or removed. It also backs up to your account.'
    );
  });
});

describe('importOutboxEntries', () => {
  it('queues every imported row; sessions keep their own clock', () => {
    const plan: ImportPlan = {
      ...emptyPlan,
      sessions: [session('s1', '2026-01-02T00:00:00.000Z'), session('s2')],
      templates: [{ id: 't1', name: 'T', exerciseIds: [] }],
      templateFolders: [{ id: 'f1', name: 'F' }],
      customExercises: [{ id: 'c1' } as never],
    };
    const entries = importOutboxEntries(plan, { bench: { weightKg: 60 } }, {}, NOW);
    expect(entries.map((e) => `${e.entityType}:${e.entityId}:${e.updatedAt}`)).toEqual([
      'session:s1:2026-01-02T00:00:00.000Z',
      'session:s2:2026-01-01T10:00:00.000Z',
      `template:t1:${NOW}`,
      `template_folder:f1:${NOW}`,
      `custom_exercise:c1:${NOW}`,
      `exercise_previous:default:${NOW}`,
    ]);
    expect(entries.every((e) => e.op === 'upsert')).toBe(true);
    expect(entries.at(-1)?.payload).toEqual({ bench: { weightKg: 60 } });
  });

  it('adds the merged notes snapshot only when notes were imported, and previous only with sessions', () => {
    const entries = importOutboxEntries({ ...emptyPlan, exerciseNotes: { squat: 'New' } }, {}, { squat: 'New', bench: 'Old' }, NOW);
    expect(entries).toEqual([
      { entityType: 'exercise_note', entityId: 'default', op: 'upsert', payload: { squat: 'New', bench: 'Old' }, updatedAt: NOW },
    ]);
    expect(importOutboxEntries(emptyPlan, {}, {}, NOW)).toEqual([]);
  });
});
