import { describe, expect, it } from 'vitest';
import {
  parseProFeatureParam,
  requiresProToStart,
  subscriptionPaywallPath,
} from './features';
import { BUILT_IN_TEMPLATES } from '@/data/builtInTemplates';

describe('pro gates', () => {
  it('lets built-in templates start on Basic and gates custom ones', () => {
    expect(requiresProToStart({ isBuiltIn: true })).toBe(false);
    expect(requiresProToStart({ isBuiltIn: false })).toBe(true);
    expect(requiresProToStart({})).toBe(true);
  });

  it('keeps five built-in programs for the Basic tier', () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(5);
    expect(BUILT_IN_TEMPLATES.every((t) => t.isBuiltIn)).toBe(true);
  });

  it('round-trips paywall feature params', () => {
    expect(parseProFeatureParam('personal_records')).toBe('personal_records');
    expect(parseProFeatureParam('not-a-feature')).toBeNull();
    expect(subscriptionPaywallPath('custom_templates')).toBe(
      '/subscription?feature=custom_templates'
    );
  });
});
