import { describe, expect, it } from 'vitest';
import type { Exercise, MuscleId, WorkoutSession } from '@muscleos/types';
import { recoveryFromSessions } from './recovery';

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
