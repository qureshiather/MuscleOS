import { describe, expect, it } from 'vitest';
import type { SessionExercise, WorkoutSession } from '@muscleos/types';
import { bestSetLabel, SHARE_CARD_MAX_LIFTS, shareCardModel } from './shareCard';

/** docs/features/history-analytics.md#sharing-a-workout */

const session = (exercises: SessionExercise[], minutes = 52): WorkoutSession =>
  ({
    id: 's1',
    templateId: 'ppl-push',
    startedAt: '2026-09-15T10:00:00.000Z',
    completedAt: new Date(Date.UTC(2026, 8, 15, 10, minutes)).toISOString(),
    exercises,
  }) as WorkoutSession;

const ex = (exerciseId: string, ...sets: [reps: number, kg?: number, done?: boolean][]): SessionExercise =>
  ({
    exerciseId,
    sets: sets.map(([reps, weightKg, completed = true]) => ({ reps, weightKg, completed })),
  }) as SessionExercise;

const opts = {
  title: 'Push',
  nameOf: (id: string) => ({ bench: 'Bench Press', ohp: 'Overhead Press', dips: 'Dips' })[id] ?? id,
  unit: 'kg' as const,
  formatDate: () => 'Tue, Sep 15',
};

describe('bestSetLabel', () => {
  it('picks the highest estimated 1RM, not just the heaviest weight', () => {
    // 90×5 (e1RM 105) beats 100×1 (100)
    expect(bestSetLabel(ex('b', [1, 100], [5, 90]).sets, 'kg')).toBe('90 kg × 5');
  });

  it('shows pounds, and the most reps for bodyweight', () => {
    expect(bestSetLabel(ex('b', [5, 100]).sets, 'lb')).toBe('220.5 lb × 5');
    expect(bestSetLabel(ex('d', [12], [15], [10]).sets, 'kg')).toBe('15 reps');
    expect(bestSetLabel(ex('d', [1]).sets, 'kg')).toBe('1 rep');
  });

  it('ignores incomplete sets; nothing completed → null', () => {
    expect(bestSetLabel(ex('b', [5, 200, false], [5, 80]).sets, 'kg')).toBe('80 kg × 5');
    expect(bestSetLabel(ex('b', [5, 80, false]).sets, 'kg')).toBeNull();
  });
});

describe('shareCardModel', () => {
  it('title, date, duration · sets · volume, and each lift with its best set and PR flag', () => {
    const m = shareCardModel(session([ex('bench', [5, 100], [5, 100]), ex('dips', [12]), ex('ohp', [5, 60, false])]), {
      ...opts,
      prExerciseIds: new Set(['bench']),
    });
    expect(m.title).toBe('Push');
    expect(m.date).toBe('Tue, Sep 15');
    expect(m.stats).toEqual([
      { label: 'Duration', value: '52m' },
      { label: 'Sets', value: '3' },
      { label: 'Volume', value: '1,000 kg' },
    ]);
    expect(m.lifts).toEqual([
      { exerciseId: 'bench', name: 'Bench Press', bestSet: '100 kg × 5', isPR: true },
      { exerciseId: 'dips', name: 'Dips', bestSet: '12 reps', isPR: false },
    ]);
    expect(m.moreCount).toBe(0);
  });

  it('drops a missing duration and zero volume', () => {
    const m = shareCardModel(session([ex('dips', [12])], 0), opts);
    expect(m.stats).toEqual([{ label: 'Sets', value: '1' }]);
  });

  it(`lists at most ${SHARE_CARD_MAX_LIFTS} lifts, then "+N more"`, () => {
    const many = Array.from({ length: 9 }, (_, i) => ex(`e${i}`, [5, 50]));
    const m = shareCardModel(session(many), opts);
    expect(m.lifts).toHaveLength(SHARE_CARD_MAX_LIFTS);
    expect(m.moreCount).toBe(3);
  });
});
