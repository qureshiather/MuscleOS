import type { SessionExercise, WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import { buildSessionPRs, buildVolumeDeltas, groupSessionsByWeek } from './historyCards';

/** Local-time ISO so week bucketing doesn't depend on the test machine's zone. */
const at = (month: number, day: number, hour = 10) => new Date(2026, month - 1, day, hour).toISOString();

const ex = (exerciseId: string, ...pairs: [number, number?][]): SessionExercise => ({
  exerciseId,
  sets: pairs.map(([reps, weightKg]) => ({ reps, weightKg, completed: true })),
});

const session = (id: string, completedAt: string, exercises: SessionExercise[], templateId = 'pull'): WorkoutSession => ({
  id,
  templateId,
  startedAt: completedAt,
  completedAt,
  exercises,
});

describe('buildSessionPRs', () => {
  it('flags an exercise whose best e1RM beats every earlier session', () => {
    const prs = buildSessionPRs([
      session('c', at(9, 27), [ex('row', [8, 75]), ex('curl', [10, 30])]),
      session('a', at(9, 13), [ex('row', [8, 70]), ex('curl', [10, 30])]),
      session('b', at(9, 20), [ex('row', [8, 72.5])]),
    ]);
    expect([...(prs.get('b') ?? [])]).toEqual(['row']);
    expect([...(prs.get('c') ?? [])]).toEqual(['row']);
    expect(prs.has('a')).toBe(false);
  });

  it('treats the first session as a baseline and ties as not a PR', () => {
    const prs = buildSessionPRs([
      session('a', at(9, 13), [ex('row', [8, 70])]),
      session('b', at(9, 20), [ex('row', [8, 70])]),
    ]);
    expect(prs.size).toBe(0);
  });

  it('compares e1RM, so fewer reps at more weight can still be a PR', () => {
    const prs = buildSessionPRs([
      session('a', at(9, 13), [ex('squat', [5, 100])]),
      session('b', at(9, 20), [ex('squat', [1, 120])]),
    ]);
    expect(prs.get('b')?.has('squat')).toBe(true);
  });

  it('ignores bodyweight, incomplete, and in-progress sets', () => {
    const prs = buildSessionPRs([
      session('a', at(9, 13), [ex('pullup', [8]), ex('row', [8, 70])]),
      session('b', at(9, 20), [
        ex('pullup', [12]),
        { exerciseId: 'row', sets: [{ reps: 8, weightKg: 100, completed: false }] },
      ]),
      { ...session('c', at(9, 21), [ex('row', [8, 100])]), completedAt: undefined },
    ]);
    expect(prs.size).toBe(0);
  });
});

describe('buildVolumeDeltas', () => {
  it('compares against the previous session of the same template', () => {
    const deltas = buildVolumeDeltas([
      session('push1', at(9, 19), [ex('bench', [10, 100])], 'push'),
      session('pull1', at(9, 20), [ex('row', [10, 50])]),
      session('pull2', at(9, 27), [ex('row', [10, 52])]),
      session('push2', at(9, 26), [ex('bench', [10, 97])], 'push'),
    ]);
    expect(deltas.get('pull2')).toBe(4);
    expect(deltas.get('push2')).toBe(-3);
    expect(deltas.has('pull1')).toBe(false);
  });

  it('skips empty workouts and zero-volume sessions', () => {
    const deltas = buildVolumeDeltas([
      session('e1', at(9, 20), [ex('row', [10, 50])], '_empty'),
      session('e2', at(9, 27), [ex('row', [10, 60])], '_empty'),
      session('b1', at(9, 21), [ex('pullup', [10])], 'bw'),
      session('b2', at(9, 28), [ex('pullup', [12])], 'bw'),
    ]);
    expect(deltas.size).toBe(0);
  });
});

describe('groupSessionsByWeek', () => {
  // Wednesday, Sep 30 2026. This week starts Monday Sep 28.
  const now = new Date(2026, 8, 30, 12);

  it('buckets Monday-start weeks newest first with labels and volume', () => {
    const weeks = groupSessionsByWeek(
      [
        session('mon', at(9, 28), [ex('row', [10, 50])]),
        session('sun', at(9, 27), [ex('row', [10, 40])]),
        session('sat', at(9, 26), [ex('row', [10, 10])]),
        session('old', at(9, 9), [ex('row', [10, 10])]),
      ],
      now
    );
    expect(weeks.map((w) => w.label)).toEqual(['This week', 'Last week', 'Week of Sep 7']);
    expect(weeks.map((w) => w.sessions.map((s) => s.id))).toEqual([['mon'], ['sun', 'sat'], ['old']]);
    expect(weeks[1].volumeKg).toBe(500);
  });

  it('adds the year for weeks in an earlier year', () => {
    const weeks = groupSessionsByWeek([session('x', new Date(2025, 11, 3, 10).toISOString(), [])], now);
    expect(weeks[0].label).toBe('Week of Dec 1, 2025');
  });
});
