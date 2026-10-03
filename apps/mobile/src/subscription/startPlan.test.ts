import { describe, expect, it } from 'vitest';
import { startPlanFromParams } from './startPlan';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';

const push = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push');
if (!push) throw new Error('ppl-push missing');
const pushIds = push.exerciseIds;
const smuggled = { exerciseIds: 'deadlift,squat', sets: '9,9' };

describe('startPlanFromParams', () => {
  it('builds a Basic built-in start from the template, ignoring smuggled URL exercises and sets', () => {
    const plan = startPlanFromParams({ isPro: false, template: push, params: smuggled });
    expect(plan.map((p) => p.exerciseId)).toEqual(pushIds);
    expect(plan.every((p) => p.sets === 3 && p.warmUpSets === 0)).toBe(true);
  });

  it('builds a Basic built-in start from the template when the link has no exercises', () => {
    const plan = startPlanFromParams({ isPro: false, template: push, params: {} });
    expect(plan.map((p) => p.exerciseId)).toEqual(pushIds);
  });

  it('uses the URL plan for Pro (what home and preview encode)', () => {
    const plan = startPlanFromParams({ isPro: true, template: push, params: smuggled });
    expect(plan.map((p) => p.exerciseId)).toEqual(['deadlift', 'squat']);
  });

  it('falls back to the template for Pro when the link carries no exercises', () => {
    const plan = startPlanFromParams({ isPro: true, template: push, params: {} });
    expect(plan.map((p) => p.exerciseId)).toEqual(pushIds);
  });

  it('uses the URL plan for an unknown template (Pro ad-hoc / empty)', () => {
    expect(
      startPlanFromParams({ isPro: true, template: undefined, params: { exerciseIds: 'squat' } }).map(
        (p) => p.exerciseId
      )
    ).toEqual(['squat']);
    expect(startPlanFromParams({ isPro: true, template: undefined, params: {} })).toEqual([]);
  });
});
