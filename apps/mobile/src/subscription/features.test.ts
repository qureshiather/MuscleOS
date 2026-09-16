import { describe, expect, it } from 'vitest';
import {
  blockedStartFeature,
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
  });
});

describe('blockedStartFeature (deep-link / notification start guard)', () => {
  const builtIn = { isBuiltIn: true };
  const custom = { isBuiltIn: false };

  it('never blocks a Pro user', () => {
    expect(blockedStartFeature({ isPro: true, templateId: '_empty', template: undefined })).toBeNull();
    expect(blockedStartFeature({ isPro: true, templateId: 'tpl_1', template: custom })).toBeNull();
  });

  it('blocks a Basic user from starting an empty workout', () => {
    expect(blockedStartFeature({ isPro: false, templateId: '_empty', template: undefined })).toBe(
      'empty_workout'
    );
  });

  it('blocks a Basic user from starting a custom template', () => {
    expect(blockedStartFeature({ isPro: false, templateId: 'tpl_1', template: custom })).toBe(
      'custom_templates'
    );
  });

  it('lets a Basic user start a built-in template', () => {
    expect(blockedStartFeature({ isPro: false, templateId: 'ppl-push', template: builtIn })).toBeNull();
  });

  it('allows an unknown template through (nothing to gate on)', () => {
    expect(blockedStartFeature({ isPro: false, templateId: 'tpl_missing', template: undefined })).toBeNull();
  });
});
