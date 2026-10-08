import type { SessionExercise, WorkoutSession } from '@muscleos/types';
import { describe, expect, it } from 'vitest';
import type { ExercisePR, SetWithDate } from './oneRepMax';
import {
  exerciseHasHistory,
  filterPRsByName,
  hasStrengthProfile,
  PR_CARD_MAX_BARS,
  prCardModel,
  progressionPoints,
  strengthAgeNote,
  strengthSummary,
} from './personalRecords';

const day = (d: number) => new Date(Date.UTC(2026, 0, d, 10)).toISOString();
const point = (d: number, e1rm: number): SetWithDate => ({
  weightKg: e1rm,
  reps: 1,
  estimated1RM: e1rm,
  completedAt: day(d),
});

/** History newest first, like buildExercisePRs. */
const pr = (exerciseId: string, history: SetWithDate[]): ExercisePR => {
  const best = history.reduce((a, b) => (b.estimated1RM > a.estimated1RM ? b : a), history[0]);
  return {
    exerciseId,
    bestEstimated1RM: best?.estimated1RM ?? 0,
    bestSet: best ? { weightKg: best.weightKg, reps: best.reps } : null,
    history: [...history].sort((a, b) => b.completedAt.localeCompare(a.completedAt)),
  };
};

describe('progressionPoints', () => {
  it('orders points oldest to newest with bar ratios to the best e1RM', () => {
    const points = progressionPoints([point(3, 100), point(1, 50), point(2, 80)], 100);
    expect(points.map((p) => p.completedAt)).toEqual([day(1), day(2), day(3)]);
    expect(points.map((p) => p.ratio)).toEqual([0.5, 0.8, 1]);
  });

  it('keeps one point per set, including several on one day', () => {
    const points = progressionPoints([point(1, 50), point(1, 60)], 60);
    expect(points).toHaveLength(2);
  });

  it('caps ratios at 1 and uses 0 when there is no best', () => {
    expect(progressionPoints([point(1, 120)], 100)[0].ratio).toBe(1);
    expect(progressionPoints([point(1, 50)], 0)[0].ratio).toBe(0);
  });
});

describe('prCardModel', () => {
  const noProfile = {};

  it('shows no bars with fewer than 2 qualifying sets', () => {
    expect(prCardModel(pr('squat', [point(1, 100)]), noProfile).bars).toBeNull();
    expect(prCardModel(pr('squat', [point(1, 100), point(2, 90)]), noProfile).bars).toHaveLength(2);
  });

  it('shows the 10 most recent sets, oldest to newest like the chart', () => {
    const history = Array.from({ length: 14 }, (_, i) => point(i + 1, 50 + i));
    const bars = prCardModel(pr('squat', history), noProfile).bars!;
    expect(PR_CARD_MAX_BARS).toBe(10);
    expect(bars).toHaveLength(10);
    expect(bars[0].completedAt).toBe(day(5));
    expect(bars[9].completedAt).toBe(day(14));
    expect(bars[9].ratio).toBe(1);
  });

  it('gates the strength chip on bodyweight and sex', () => {
    const squat = pr('squat', [point(1, 140)]);
    expect(prCardModel(squat, {}).strength).toBeNull();
    expect(prCardModel(squat, { weightKg: 80 }).strength).toBeNull();
    expect(prCardModel(squat, { sex: 'male' }).strength).toBeNull();
    expect(prCardModel(squat, { weightKg: 0, sex: 'male' }).strength).toBeNull();
    // 140 / 80 = 1.75 → intermediate (male), next advanced at 2.25 × 80.
    expect(prCardModel(squat, { weightKg: 80, sex: 'male' }).strength).toEqual({
      level: 'intermediate',
      label: 'Intermediate',
      next: { label: 'Advanced', oneRepMaxKg: 180 },
      adjustedForAge: null,
    });
  });

  it('adjusts for age when the profile has one, and says so', () => {
    const squat = pr('squat', [point(1, 140)]);
    // 140 / 80 = 1.75: intermediate unadjusted; at 60 (×1.34) advanced is 2.25 / 1.34 = 1.68.
    const strength = prCardModel(squat, { weightKg: 80, sex: 'male', age: 60 }).strength!;
    expect(strength.level).toBe('advanced');
    expect(strength.adjustedForAge).toBe(60);
    expect(strengthAgeNote(strength)).toBe('Adjusted for age 60');
    // 23–40 changes nothing, so there's nothing to say.
    const prime = prCardModel(squat, { weightKg: 80, sex: 'male', age: 30 }).strength!;
    expect(prime.level).toBe('intermediate');
    expect(prime.adjustedForAge).toBeNull();
    expect(strengthAgeNote(prime)).toBeNull();
  });

  it('shows no strength level under 14', () => {
    expect(prCardModel(pr('squat', [point(1, 140)]), { weightKg: 80, sex: 'male', age: 13 }).strength).toBeNull();
  });

  it('shows no chip for exercises without standards (incl. pull-up)', () => {
    const profile = { weightKg: 80, sex: 'male' as const };
    expect(prCardModel(pr('pull-up', [point(1, 100)]), profile).strength).toBeNull();
    expect(prCardModel(pr('bicep-curl', [point(1, 40)]), profile).strength).toBeNull();
  });

  it('has no next level at elite', () => {
    expect(strengthSummary('squat', 250, { weightKg: 80, sex: 'male' })).toMatchObject({
      level: 'elite',
      next: null,
    });
  });
});

describe('hasStrengthProfile', () => {
  it('needs a positive bodyweight and a sex', () => {
    expect(hasStrengthProfile({ weightKg: 70, sex: 'female' })).toBe(true);
    expect(hasStrengthProfile({ weightKg: 70 })).toBe(false);
    expect(hasStrengthProfile({ sex: 'female' })).toBe(false);
    expect(hasStrengthProfile({ weightKg: 0, sex: 'female' })).toBe(false);
  });
});

describe('filterPRsByName', () => {
  const prs = [pr('bench-press', [point(1, 100)]), pr('squat', [point(1, 140)])];
  const names: Record<string, string> = { 'bench-press': 'Bench Press', squat: 'Back Squat' };
  const nameOf = (id: string) => names[id] ?? id;

  it('returns everything, in order, for a blank query', () => {
    expect(filterPRsByName(prs, '  ', nameOf).map((p) => p.exerciseId)).toEqual(['bench-press', 'squat']);
  });

  it('matches on the exercise name, case-insensitively', () => {
    expect(filterPRsByName(prs, 'SQUAT', nameOf).map((p) => p.exerciseId)).toEqual(['squat']);
    expect(filterPRsByName(prs, 'bench', nameOf).map((p) => p.exerciseId)).toEqual(['bench-press']);
    expect(filterPRsByName(prs, 'deadlift', nameOf)).toEqual([]);
  });
});

describe('exerciseHasHistory', () => {
  const session = (exercises: SessionExercise[], completedAt?: string): WorkoutSession => ({
    id: 's1',
    templateId: 'push',
    startedAt: '2026-01-01T10:00:00.000Z',
    completedAt,
    exercises,
  });
  const logged = (exerciseId: string, completed = true): SessionExercise => ({
    exerciseId,
    sets: [{ completed, weightKg: 60, reps: 5 }],
  });

  it('is true once a completed session has a qualifying set of the exercise', () => {
    const sessions = [session([logged('squat')], '2026-01-01T11:00:00.000Z')];
    expect(exerciseHasHistory(sessions, 'squat')).toBe(true);
    expect(exerciseHasHistory(sessions, 'bench-press')).toBe(false);
  });

  it('ignores incomplete sets and unfinished sessions', () => {
    expect(exerciseHasHistory([session([logged('squat', false)], '2026-01-01T11:00:00.000Z')], 'squat')).toBe(false);
    expect(exerciseHasHistory([session([logged('squat')])], 'squat')).toBe(false);
  });

  it('counts sets logged under an alias of the exercise', () => {
    const sessions = [session([logged('back-squat')], '2026-01-01T11:00:00.000Z')];
    const canonical = (id: string) => (id === 'back-squat' ? 'squat' : id);
    expect(exerciseHasHistory(sessions, 'squat', canonical)).toBe(true);
  });
});
