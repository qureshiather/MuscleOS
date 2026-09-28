import { describe, expect, it } from 'vitest';
import type { Exercise, MuscleId, WorkoutSession } from '@muscleos/types';
import {
  activeRecoveryAt,
  justTrainedMuscleIds,
  recentlyWorkedMuscleIds,
  recoveryFromSessions,
} from './recovery';

const musclesById: Record<string, MuscleId[]> = {
  bench: ['chest', 'triceps'],
  squat: ['quads', 'glutes'],
};
const getExercise = (id: string): Exercise | undefined =>
  musclesById[id] ? ({ id, name: id, muscles: musclesById[id] } as Exercise) : undefined;

const session = (over: Partial<WorkoutSession>): WorkoutSession => ({
  id: 'session_1',
  templateId: 't',
  startedAt: '2026-01-01T10:00:00.000Z',
  exercises: [],
  ...over,
});

const byMuscle = (rows: { muscleId: MuscleId; trainedAt: string }[]) =>
  Object.fromEntries(rows.map((r) => [r.muscleId, r.trainedAt]));

describe('recoveryFromSessions', () => {
  it('records the latest completedAt per muscle from completed sets', () => {
    const rows = recoveryFromSessions(
      [
        session({
          completedAt: '2026-01-01T11:00:00.000Z',
          exercises: [{ exerciseId: 'bench', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
        }),
      ],
      getExercise
    );
    expect(byMuscle(rows)).toEqual({
      chest: '2026-01-01T11:00:00.000Z',
      triceps: '2026-01-01T11:00:00.000Z',
    });
  });

  it('ignores in-progress sessions (no completedAt)', () => {
    const rows = recoveryFromSessions(
      [
        session({
          completedAt: undefined,
          exercises: [{ exerciseId: 'bench', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
        }),
      ],
      getExercise
    );
    expect(rows).toEqual([]);
  });

  it('ignores exercises with no completed set', () => {
    const rows = recoveryFromSessions(
      [
        session({
          completedAt: '2026-01-01T11:00:00.000Z',
          exercises: [{ exerciseId: 'bench', sets: [{ completed: false, weightKg: 60, reps: 5 }] }],
        }),
      ],
      getExercise
    );
    expect(rows).toEqual([]);
  });

  it('keeps the most recent training time when a muscle is hit across sessions', () => {
    const rows = recoveryFromSessions(
      [
        session({
          id: 'session_old',
          completedAt: '2026-01-01T11:00:00.000Z',
          exercises: [{ exerciseId: 'bench', sets: [{ completed: true, weightKg: 60, reps: 5 }] }],
        }),
        session({
          id: 'session_new',
          completedAt: '2026-01-05T11:00:00.000Z',
          exercises: [{ exerciseId: 'bench', sets: [{ completed: true, weightKg: 65, reps: 5 }] }],
        }),
      ],
      getExercise
    );
    expect(byMuscle(rows).chest).toBe('2026-01-05T11:00:00.000Z');
  });

  it('uses completedAt, not startedAt, as the training time', () => {
    const rows = recoveryFromSessions(
      [
        session({
          startedAt: '2026-01-01T08:00:00.000Z',
          completedAt: '2026-01-01T09:30:00.000Z',
          exercises: [{ exerciseId: 'squat', sets: [{ completed: true, weightKg: 100, reps: 5 }] }],
        }),
      ],
      getExercise
    );
    expect(byMuscle(rows).quads).toBe('2026-01-01T09:30:00.000Z');
  });
});

describe('recoveryFromSessions fallback', () => {
  it('falls back to the bundled catalog when the lookup has no muscles for an id', () => {
    const rows = recoveryFromSessions([
      session({
        completedAt: '2026-01-01T11:00:00.000Z',
        exercises: [{ exerciseId: 'squat', sets: [{ completed: true, reps: 5 }] }],
      }),
    ]);
    expect(rows.map((r) => r.muscleId)).toContain('quads');
  });
});

describe('activeRecoveryAt', () => {
  const trainedAt = '2026-01-01T12:00:00.000Z';
  const biceps = { muscleId: 'biceps' as const, trainedAt }; // 36h
  const chest = { muscleId: 'chest' as const, trainedAt }; // 72h

  it('keeps a muscle until the exact expiry instant, then drops it', () => {
    const justBefore = new Date(Date.parse(trainedAt) + 36 * 3600_000 - 1);
    const atExpiry = new Date(Date.parse(trainedAt) + 36 * 3600_000);
    expect(activeRecoveryAt([biceps, chest], justBefore).map((r) => r.muscleId)).toEqual([
      'biceps',
      'chest',
    ]);
    expect(activeRecoveryAt([biceps, chest], atExpiry).map((r) => r.muscleId)).toEqual(['chest']);
  });

  it('halves every window when not natty', () => {
    const at36h = new Date(Date.parse(trainedAt) + 36 * 3600_000);
    expect(activeRecoveryAt([chest], at36h, { notNatty: true })).toEqual([]);
    expect(activeRecoveryAt([chest], at36h, { notNatty: false })).toEqual([chest]);
  });
});

describe('justTrainedMuscleIds', () => {
  it('is the muscles sharing the latest trainedAt, ties included', () => {
    const latest = '2026-01-03T10:00:00.000Z';
    expect(
      justTrainedMuscleIds([
        { muscleId: 'chest', trainedAt: '2026-01-01T10:00:00.000Z' },
        { muscleId: 'quads', trainedAt: latest },
        { muscleId: 'glutes', trainedAt: latest },
      ])
    ).toEqual(['quads', 'glutes']);
  });

  it('is empty when nothing is recovering', () => {
    expect(justTrainedMuscleIds([])).toEqual([]);
  });
});

describe('recentlyWorkedMuscleIds', () => {
  const now = Date.parse('2026-01-10T12:00:00.000Z');
  const done = (completedAt: string, exerciseId: string, completed = true) =>
    session({ completedAt, exercises: [{ exerciseId, sets: [{ completed, reps: 5 }] }] });

  it('collects muscles from completed sessions in the last 7 days', () => {
    const ids = recentlyWorkedMuscleIds(
      [done('2026-01-04T12:00:00.000Z', 'bench'), done('2026-01-02T12:00:00.000Z', 'squat')],
      now,
      getExercise
    );
    expect([...ids].sort()).toEqual(['chest', 'triceps']);
  });

  it('ignores exercises with no completed set and in-progress sessions', () => {
    const ids = recentlyWorkedMuscleIds(
      [
        done('2026-01-09T12:00:00.000Z', 'bench', false),
        session({ exercises: [{ exerciseId: 'squat', sets: [{ completed: true, reps: 5 }] }] }),
      ],
      now,
      getExercise
    );
    expect(ids.size).toBe(0);
  });
});
