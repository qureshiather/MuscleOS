import { describe, expect, it } from 'vitest';
import {
  BASIC_FEATURES_LIST,
  EMPTY_WORKOUT_TEMPLATE_ID,
  midWorkoutEditDecision,
  PRO_FEATURE_LABELS,
  PRO_FEATURES_LIST,
  type ProFeature,
  parseProFeatureParam,
  requiresProToStart,
  shouldRedirectToPaywall,
  startFromParamsDecision,
  subscriptionPaywallPath,
} from './features';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';

describe('pro gates', () => {
  it('lets built-in templates start on Basic and gates custom ones', () => {
    expect(requiresProToStart({ isBuiltIn: true })).toBe(false);
    expect(requiresProToStart({ isBuiltIn: false })).toBe(true);
    expect(requiresProToStart({})).toBe(true);
  });

  it('keeps built-in programs for the Basic tier', () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(9);
    expect(BUILT_IN_TEMPLATES.every((t) => t.isBuiltIn)).toBe(true);
  });

  it('round-trips paywall feature params', () => {
    expect(parseProFeatureParam('personal_records')).toBe('personal_records');
    expect(parseProFeatureParam('not-a-feature')).toBeNull();
    expect(subscriptionPaywallPath('custom_templates')).toBe(
      '/subscription?feature=custom_templates'
    );
    expect(subscriptionPaywallPath()).toBe('/subscription');
  });
});

describe('startFromParamsDecision (deep-link / notification start guard)', () => {
  const builtIn = { isBuiltIn: true };
  const custom = { isBuiltIn: false };
  const ready = {
    hasSession: false,
    templatesLoaded: true,
    subscriptionLoaded: true,
    isPro: false,
    templateId: 'ppl-push',
    template: builtIn as { isBuiltIn?: boolean } | undefined,
  };

  it('uses _empty as the empty-workout id', () => {
    expect(EMPTY_WORKOUT_TEMPLATE_ID).toBe('_empty');
  });

  it('never touches an existing session (lapse does not block finishing)', () => {
    expect(startFromParamsDecision({ ...ready, hasSession: true, templateId: '_empty' })).toBe('wait');
    expect(startFromParamsDecision({ ...ready, hasSession: true, template: custom })).toBe('wait');
  });

  it('does nothing without a templateId', () => {
    expect(startFromParamsDecision({ ...ready, templateId: '', template: undefined })).toBe('wait');
  });

  it('waits for templates to load instead of deciding on an empty list', () => {
    expect(
      startFromParamsDecision({ ...ready, templatesLoaded: false, templateId: 'tpl_1', template: undefined })
    ).toBe('wait');
  });

  it('waits for the subscription tier so Pro is never bounced', () => {
    expect(
      startFromParamsDecision({ ...ready, subscriptionLoaded: false, templateId: '_empty', template: undefined })
    ).toBe('wait');
  });

  it('starts anything for Pro: empty, custom, unknown, built-in', () => {
    const pro = { ...ready, isPro: true };
    expect(startFromParamsDecision({ ...pro, templateId: '_empty', template: undefined })).toBe('start');
    expect(startFromParamsDecision({ ...pro, templateId: 'tpl_1', template: custom })).toBe('start');
    expect(startFromParamsDecision({ ...pro, templateId: 'tpl_x', template: undefined })).toBe('start');
    expect(startFromParamsDecision(pro)).toBe('start');
  });

  it('starts a known built-in on Basic', () => {
    expect(startFromParamsDecision(ready)).toBe('start');
  });

  it('sends Basic to the empty_workout paywall for _empty', () => {
    expect(startFromParamsDecision({ ...ready, templateId: '_empty', template: undefined })).toBe(
      'empty_workout'
    );
  });

  it('sends Basic to the empty_workout paywall for an unknown id (no ad-hoc workout hole)', () => {
    expect(startFromParamsDecision({ ...ready, templateId: 'tpl_missing', template: undefined })).toBe(
      'empty_workout'
    );
  });

  it('sends Basic to the custom_templates paywall for a custom template', () => {
    expect(startFromParamsDecision({ ...ready, templateId: 'tpl_1', template: custom })).toBe(
      'custom_templates'
    );
  });
});

describe('shouldRedirectToPaywall (useRequirePro)', () => {
  it('redirects Basic once the tier is known', () => {
    expect(shouldRedirectToPaywall({ isPro: false, isLoading: false })).toBe(true);
  });
  it('never redirects while loading', () => {
    expect(shouldRedirectToPaywall({ isPro: false, isLoading: true })).toBe(false);
  });
  it('never redirects Pro', () => {
    expect(shouldRedirectToPaywall({ isPro: true, isLoading: false })).toBe(false);
    expect(shouldRedirectToPaywall({ isPro: true, isLoading: true })).toBe(false);
  });
});

describe('midWorkoutEditDecision', () => {
  const actions = ['add', 'replace', 'remove'] as const;

  it('allows everything for Pro, built-in or not', () => {
    for (const action of actions) {
      expect(midWorkoutEditDecision({ action, isBuiltIn: true, isPro: true })).toBe('allow');
      expect(midWorkoutEditDecision({ action, isBuiltIn: false, isPro: true })).toBe('allow');
    }
  });

  it('shows the built-in alert (not the paywall) for every edit on a Basic built-in workout', () => {
    for (const action of actions) {
      expect(midWorkoutEditDecision({ action, isBuiltIn: true, isPro: false })).toBe('builtin-alert');
    }
  });

  it('gates add and replace on Basic outside built-ins, and allows remove', () => {
    expect(midWorkoutEditDecision({ action: 'add', isBuiltIn: false, isPro: false })).toBe(
      'add_exercise_mid_workout'
    );
    expect(midWorkoutEditDecision({ action: 'replace', isBuiltIn: false, isPro: false })).toBe(
      'replace_exercise_mid_workout'
    );
    expect(midWorkoutEditDecision({ action: 'remove', isBuiltIn: false, isPro: false })).toBe('allow');
  });
});

describe('paywall copy', () => {
  it('keeps the Basic and Pro comparison columns the same length (5 each)', () => {
    expect(BASIC_FEATURES_LIST).toHaveLength(5);
    expect(PRO_FEATURES_LIST).toHaveLength(5);
  });

  it('labels every gate key used by the gate map', () => {
    const keys: ProFeature[] = [
      'custom_templates',
      'custom_exercises',
      'empty_workout',
      'add_exercise_mid_workout',
      'replace_exercise_mid_workout',
      'save_as_template',
      'personal_records',
      'exercise_progression',
      'monthly_calendar',
    ];
    expect(Object.keys(PRO_FEATURE_LABELS).sort()).toEqual([...keys].sort());
    for (const k of keys) expect(parseProFeatureParam(k)).toBe(k);
  });

  it('rejects unknown paywall params', () => {
    expect(parseProFeatureParam('grant_everything')).toBeNull();
    expect(parseProFeatureParam(undefined)).toBeNull();
  });
});
