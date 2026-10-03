import { describe, expect, it } from 'vitest';
import { DEFAULT_REST_SECONDS } from '@/store/activeWorkoutLogic';
import { formatPrevious, formatRestDuration, previewEntryState } from './workoutPreview';

describe('formatRestDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatRestDuration(120)).toBe('2:00');
    expect(formatRestDuration(90)).toBe('1:30');
    expect(formatRestDuration(65)).toBe('1:05');
    expect(formatRestDuration(5)).toBe('0:05');
    expect(formatRestDuration(0)).toBe('0:00');
  });

  it('the preview badge uses the 2:00 app default', () => {
    expect(formatRestDuration(DEFAULT_REST_SECONDS)).toBe('2:00');
  });
});

describe('formatPrevious', () => {
  it('shows weight × reps in kg', () => {
    expect(formatPrevious({ weightKg: 60, reps: 5 }, 'kg')).toBe('Previous: 60 kg × 5');
  });

  it('converts to pounds at the display edge', () => {
    expect(formatPrevious({ weightKg: 100, reps: 3 }, 'lb')).toBe('Previous: 220.5 lb × 3');
  });

  it('drops reps when unknown', () => {
    expect(formatPrevious({ weightKg: 40 }, 'kg')).toBe('Previous: 40 kg');
  });

  it('is omitted (null) with no previous', () => {
    expect(formatPrevious(undefined, 'kg')).toBeNull();
    expect(formatPrevious(null, 'lb')).toBeNull();
  });
});

describe('previewEntryState', () => {
  it('missing template id or exercises → missing', () => {
    expect(previewEntryState({ templateId: '', exerciseIds: ['a'], hasActiveSession: false })).toBe(
      'missing'
    );
    expect(previewEntryState({ templateId: 'ppl-push', exerciseIds: [], hasActiveSession: false })).toBe(
      'missing'
    );
  });

  it('a workout in progress wins', () => {
    expect(previewEntryState({ templateId: 'ppl-push', exerciseIds: ['a'], hasActiveSession: true })).toBe(
      'active-session'
    );
  });

  it('otherwise ready', () => {
    expect(previewEntryState({ templateId: 'ppl-push', exerciseIds: ['a'], hasActiveSession: false })).toBe(
      'ready'
    );
  });
});
