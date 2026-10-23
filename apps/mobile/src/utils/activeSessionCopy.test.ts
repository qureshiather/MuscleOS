import { describe, expect, it } from 'vitest';
import { activeSessionCopy } from './activeSessionCopy';

describe('activeSessionCopy', () => {
  it('names a running workout as a workout', () => {
    const copy = activeSessionCopy({});
    expect(copy.resumeLabel).toBe('Resume workout');
    expect(copy.blockedTitle).toBe('Workout in progress');
    expect(copy.blockedStartMessage).toBe('Finish or cancel your current workout before starting another.');
  });

  it('names an edit to a finished workout as an edit', () => {
    const copy = activeSessionCopy({ completedAt: '2026-10-20T11:00:00.000Z' });
    expect(copy.resumeLabel).toBe('Resume editing');
    expect(copy.discardLabel).toBe('Discard changes');
    expect(copy.blockedTitle).toBe('Edit in progress');
  });
});
