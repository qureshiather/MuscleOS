import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@muscleos/types';
import { workoutNotificationCopy } from './workoutNotificationCopy';

// Name lookup is injected so the copy logic stays pure and testable.
const nameOf = (id: string) => ({ bench: 'Bench Press', squat: 'Squat', row: 'Barbell Row' }[id] ?? id);

const session = (exercises: WorkoutSession['exercises']): WorkoutSession => ({
  id: 'session_1',
  templateId: 't',
  startedAt: '2026-01-01T10:00:00.000Z',
  exercises,
});

const done = { completed: true };
const todo = { completed: false };

describe('workoutNotificationCopy', () => {
  it('with no rest running, names the first exercise with unlogged sets ("Next: …")', () => {
    const s = session([
      { exerciseId: 'bench', sets: [done, todo] },
      { exerciseId: 'squat', sets: [todo] },
    ]);
    expect(workoutNotificationCopy(s, null, nameOf).idleBody).toBe('Next: Bench Press');
  });

  it('while resting on an exercise that still has sets, stays on it ("Next: …")', () => {
    const s = session([
      { exerciseId: 'bench', sets: [done, todo] },
      { exerciseId: 'squat', sets: [todo] },
    ]);
    const copy = workoutNotificationCopy(s, { exIdx: 0, setIdx: 0 }, nameOf);
    expect(copy.restBody).toBe('Next: Bench Press');
    expect(copy.alertBody).toBe('Time for Bench Press');
  });

  it('while resting after finishing an exercise, advances to the next one ("Continue to …")', () => {
    const s = session([
      { exerciseId: 'bench', sets: [done, done] },
      { exerciseId: 'squat', sets: [todo] },
    ]);
    expect(workoutNotificationCopy(s, { exIdx: 0, setIdx: 1 }, nameOf).restBody).toBe(
      'Continue to Squat'
    );
  });

  it('wraps around to an earlier unfinished exercise when later ones are done', () => {
    const s = session([
      { exerciseId: 'bench', sets: [todo] },
      { exerciseId: 'squat', sets: [done] },
    ]);
    // Rest was on squat (index 1, all done); the only remaining work is bench before it.
    expect(workoutNotificationCopy(s, { exIdx: 1, setIdx: 0 }, nameOf).restBody).toBe(
      'Continue to Bench Press'
    );
  });

  it('says "Finish your workout" when every set is complete', () => {
    const s = session([
      { exerciseId: 'bench', sets: [done] },
      { exerciseId: 'squat', sets: [done] },
    ]);
    const copy = workoutNotificationCopy(s, { exIdx: 1, setIdx: 0 }, nameOf);
    expect(copy.restBody).toBe('Finish your workout');
    expect(copy.alertBody).toBe('Time to finish your workout');
  });
});
