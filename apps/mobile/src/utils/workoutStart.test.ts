import { describe, expect, it } from 'vitest';
import { EMPTY_WORKOUT_TEMPLATE_ID, startFromParamsDecision, startPlanFromParams } from './workoutStart';

describe('startFromParamsDecision', () => {
  const base = { hasSession: false, templatesLoaded: true, templateId: 'ppl-push' };

  it('starts once templates have loaded and nothing is running', () => {
    expect(startFromParamsDecision(base)).toBe('start');
    expect(startFromParamsDecision({ ...base, templateId: EMPTY_WORKOUT_TEMPLATE_ID })).toBe('start');
    expect(startFromParamsDecision({ ...base, templateId: 'tpl_custom' })).toBe('start');
  });

  it('waits while a workout is in progress, before templates load, or with no template id', () => {
    expect(startFromParamsDecision({ ...base, hasSession: true })).toBe('wait');
    expect(startFromParamsDecision({ ...base, templatesLoaded: false })).toBe('wait');
    expect(startFromParamsDecision({ ...base, templateId: '' })).toBe('wait');
  });
});

describe('startPlanFromParams', () => {
  const template = { exerciseIds: ['squat', 'bench-press'], exercises: [{ exerciseId: 'squat', sets: 5 }, { exerciseId: 'bench-press' }] };

  it('uses the plan in the URL when it has exercises', () => {
    const plan = startPlanFromParams({ template, params: { exerciseIds: 'deadlift', sets: '2' } });
    expect(plan).toEqual([{ exerciseId: 'deadlift', sets: 2, warmUpSets: 0 }]);
  });

  it('falls back to the template when the URL carries no exercises', () => {
    const plan = startPlanFromParams({ template, params: {} });
    expect(plan.map((p) => [p.exerciseId, p.sets])).toEqual([
      ['squat', 5],
      ['bench-press', 3],
    ]);
  });

  it('an unknown template or _empty starts with whatever the URL carries (often nothing)', () => {
    expect(startPlanFromParams({ template: undefined, params: {} })).toEqual([]);
    expect(startPlanFromParams({ template: undefined, params: { exerciseIds: 'squat' } }).map((p) => p.exerciseId)).toEqual([
      'squat',
    ]);
  });
});
