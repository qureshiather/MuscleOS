import type { SessionExercise, WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import {
  buildSessionPRs,
  buildVolumeDeltas,
  groupSessionsByWeek,
  isCardExpanded,
  sessionCardSummary,
  templateDisplayName,
  volumeDeltaLabel,
  weekSummary,
} from './historyCards';

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

describe('buildSessionPRs with aliases', () => {
  const canonical = (id: string) => (id === 'barbell-shrug' ? 'shrug' : id);

  it('compares an alias-logged lift with its canonical exercise and returns the id as logged', () => {
    const prs = buildSessionPRs(
      [
        session('a', at(9, 13), [ex('barbell-shrug', [5, 100])]),
        session('b', at(9, 20), [ex('shrug', [5, 110])]),
        session('c', at(9, 27), [ex('barbell-shrug', [5, 120])]),
      ],
      canonical
    );
    expect([...(prs.get('b') ?? [])]).toEqual(['shrug']);
    expect([...(prs.get('c') ?? [])]).toEqual(['barbell-shrug']);
    expect(prs.has('a')).toBe(false);
  });

  it('without canonicalisation treats them as different lifts (baseline each)', () => {
    const prs = buildSessionPRs([
      session('a', at(9, 13), [ex('barbell-shrug', [5, 100])]),
      session('b', at(9, 20), [ex('shrug', [5, 110])]),
    ]);
    expect(prs.size).toBe(0);
  });
});

describe('templateDisplayName', () => {
  const templates = [{ id: 'ppl-push', name: 'Push' }];

  it('uses the template name, "Empty workout" for ad-hoc sessions, else "Workout"', () => {
    expect(templateDisplayName(templates, 'ppl-push')).toBe('Push');
    expect(templateDisplayName(templates, '_empty')).toBe('Empty workout');
    expect(templateDisplayName(templates, 'deleted-template')).toBe('Workout');
  });
});

describe('isCardExpanded', () => {
  it('starts with only the newest card open, and a toggle flips either state', () => {
    const none = new Set<string>();
    expect(isCardExpanded('new', 'new', none)).toBe(true);
    expect(isCardExpanded('old', 'new', none)).toBe(false);
    expect(isCardExpanded('new', 'new', new Set(['new']))).toBe(false);
    expect(isCardExpanded('old', 'new', new Set(['old']))).toBe(true);
    expect(isCardExpanded('old', undefined, none)).toBe(false);
  });
});

describe('sessionCardSummary', () => {
  const s = (over: Partial<WorkoutSession>): WorkoutSession => ({
    id: 's',
    templateId: 'push',
    startedAt: '2026-09-27T10:00:00.000Z',
    completedAt: '2026-09-27T10:59:00.000Z',
    exercises: [],
    ...over,
  });

  it('counts exercises with a completed set and only completed sets', () => {
    const summary = sessionCardSummary(
      s({
        exercises: [
          { exerciseId: 'bench', sets: [{ completed: true, reps: 8, weightKg: 70 }, { completed: false, reps: 8 }] },
          { exerciseId: 'fly', sets: [{ completed: false, reps: 10, weightKg: 20 }] },
          { exerciseId: 'dip', sets: [{ completed: true, reps: 10 }, { completed: true, reps: 9 }] },
        ],
      }),
      undefined,
      'kg'
    );
    expect(summary.exerciseCount).toBe(2);
    expect(summary.setCount).toBe(3);
    expect(summary.exercises.map((e) => e.exerciseId)).toEqual(['bench', 'dip']);
    expect(summary.countsLine).toBe('2 exercises · 3 sets');
    expect(summary.statsLine).toBe('59m · 560 kg');
    expect(summary.prLabel).toBeNull();
  });

  it('uses singulars and counts PRs only for exercises in the card', () => {
    const summary = sessionCardSummary(
      s({ exercises: [{ exerciseId: 'bench', sets: [{ completed: true, reps: 5, weightKg: 100 }] }] }),
      new Set(['bench', 'squat']),
      'kg'
    );
    expect(summary.countsLine).toBe('1 exercise · 1 set');
    expect(summary.prCount).toBe(1);
    expect(summary.prLabel).toBe('1 PR');
  });

  it('pluralises PRs', () => {
    const summary = sessionCardSummary(
      s({
        exercises: [
          { exerciseId: 'a', sets: [{ completed: true, reps: 5, weightKg: 100 }] },
          { exerciseId: 'b', sets: [{ completed: true, reps: 5, weightKg: 100 }] },
        ],
      }),
      new Set(['a', 'b']),
      'kg'
    );
    expect(summary.prLabel).toBe('2 PRs');
  });

  it('drops zero volume and sub-minute duration from the stats line', () => {
    const bodyweight = s({ exercises: [{ exerciseId: 'dip', sets: [{ completed: true, reps: 10 }] }] });
    expect(sessionCardSummary(bodyweight, undefined, 'kg').statsLine).toBe('59m');
    const quick = s({
      completedAt: '2026-09-27T10:00:30.000Z',
      exercises: [{ exerciseId: 'bench', sets: [{ completed: true, reps: 10, weightKg: 50 }] }],
    });
    expect(sessionCardSummary(quick, undefined, 'kg').statsLine).toBe('500 kg');
    const nothing = s({ completedAt: '2026-09-27T10:00:10.000Z' });
    expect(sessionCardSummary(nothing, undefined, 'kg').statsLine).toBe('');
  });

  it('shows volume in pounds', () => {
    const summary = sessionCardSummary(
      s({ exercises: [{ exerciseId: 'bench', sets: [{ completed: true, reps: 10, weightKg: 100 }] }] }),
      undefined,
      'lb'
    );
    expect(summary.statsLine).toBe('59m · 2,205 lb');
  });
});

describe('volumeDeltaLabel', () => {
  it('shows up and down arrows with a whole percent, hidden at 0% or when missing', () => {
    expect(volumeDeltaLabel(4)).toEqual({ text: '↑4%', up: true });
    expect(volumeDeltaLabel(-3)).toEqual({ text: '↓3%', up: false });
    expect(volumeDeltaLabel(0)).toBeNull();
    expect(volumeDeltaLabel(undefined)).toBeNull();
  });
});

describe('weekSummary', () => {
  it('uses "1 session" in the singular and omits zero volume', () => {
    expect(weekSummary({ sessions: [{} as WorkoutSession], volumeKg: 8240 }, 'kg')).toBe('1 session · 8,240 kg');
    expect(weekSummary({ sessions: [{}, {}] as WorkoutSession[], volumeKg: 12_100 }, 'kg')).toBe(
      '2 sessions · 12.1k kg'
    );
    expect(weekSummary({ sessions: [{} as WorkoutSession], volumeKg: 0 }, 'kg')).toBe('1 session');
  });
});
