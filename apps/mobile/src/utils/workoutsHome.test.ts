import { describe, expect, it } from 'vitest';
import type { MuscleId, WorkoutTemplate } from '@muscleos/types';
import {
  ARCHIVED_SECTION,
  HIDDEN_BUILT_IN_SECTION,
  HIDDEN_CUSTOM_SECTION,
  SUGGESTED_TEMPLATES_LIMIT,
  customSectionVisible,
  decideTemplateStart,
  defaultFolderExpanded,
  lastDoneByTemplate,
  showLapsedNotice,
  startableTemplates,
  suggestHomeTemplates,
} from './workoutsHome';

const tpl = (id: string, over: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  id,
  name: id,
  exerciseIds: ['x'],
  isBuiltIn: true,
  ...over,
});

describe('defaultFolderExpanded', () => {
  it('real folders start open; Archived and both Hidden groups start closed', () => {
    expect(defaultFolderExpanded('folder_1')).toBe(true);
    expect(defaultFolderExpanded('builtin_ppl')).toBe(true);
    expect(defaultFolderExpanded(ARCHIVED_SECTION)).toBe(false);
    expect(defaultFolderExpanded(HIDDEN_CUSTOM_SECTION)).toBe(false);
    expect(defaultFolderExpanded(HIDDEN_BUILT_IN_SECTION)).toBe(false);
  });
});

describe('customSectionVisible / showLapsedNotice', () => {
  it('Pro always sees the Custom section, with no lapsed notice', () => {
    const counts = { isPro: true, visibleCustom: 0, hiddenCustom: 0 };
    expect(customSectionVisible(counts)).toBe(true);
    expect(showLapsedNotice({ ...counts, visibleCustom: 3 })).toBe(false);
  });

  it('Basic with no custom templates sees neither', () => {
    const counts = { isPro: false, visibleCustom: 0, hiddenCustom: 0 };
    expect(customSectionVisible(counts)).toBe(false);
    expect(showLapsedNotice(counts)).toBe(false);
  });

  it('Basic with visible custom templates sees both', () => {
    const counts = { isPro: false, visibleCustom: 1, hiddenCustom: 0 };
    expect(customSectionVisible(counts)).toBe(true);
    expect(showLapsedNotice(counts)).toBe(true);
  });

  it('hidden custom templates alone count (lapsed Pro with everything hidden)', () => {
    const counts = { isPro: false, visibleCustom: 0, hiddenCustom: 2 };
    expect(customSectionVisible(counts)).toBe(true);
    expect(showLapsedNotice(counts)).toBe(true);
  });
});

describe('lastDoneByTemplate', () => {
  it('keeps the latest completedAt per template and ignores unfinished sessions', () => {
    const map = lastDoneByTemplate([
      { templateId: 'a', completedAt: '2026-01-01T10:00:00.000Z' },
      { templateId: 'a', completedAt: '2026-01-03T10:00:00.000Z' },
      { templateId: 'a', completedAt: '2026-01-02T10:00:00.000Z' },
      { templateId: 'b', completedAt: undefined },
      { templateId: 'c', completedAt: '2026-01-05T10:00:00.000Z' },
    ]);
    expect(map).toEqual({ a: '2026-01-03T10:00:00.000Z', c: '2026-01-05T10:00:00.000Z' });
  });

  it('is empty for no sessions', () => {
    expect(lastDoneByTemplate([])).toEqual({});
  });
});

describe('startableTemplates', () => {
  const all = [tpl('built'), tpl('mine', { isBuiltIn: false })];
  it('Pro can start everything; Basic only built-ins', () => {
    expect(startableTemplates(all, true).map((t) => t.id)).toEqual(['built', 'mine']);
    expect(startableTemplates(all, false).map((t) => t.id)).toEqual(['built']);
  });
});

describe('suggestHomeTemplates', () => {
  const muscles: Record<string, MuscleId[]> = {
    chest: ['chest', 'triceps'],
    back: ['lats', 'biceps'],
    legs: ['quads', 'hamstrings'],
    mine: ['glutes', 'calves'],
    hidden: ['abs', 'forearms'],
  };
  const templates = [
    tpl('chest'),
    tpl('back'),
    tpl('legs'),
    tpl('mine', { isBuiltIn: false }),
    tpl('hidden'),
  ];
  const run = (isPro: boolean) =>
    suggestHomeTemplates({
      templates,
      isPro,
      isHidden: (t) => t.id === 'hidden',
      recoveringMuscleIds: new Set(),
      recentlyWorkedMuscleIds: new Set(),
      lastDoneByTemplate: {},
      getTemplateMuscles: (t) => muscles[t.id] ?? [],
      nowMs: Date.parse('2026-01-10T00:00:00.000Z'),
    }).map((s) => s.template.id);

  it('caps at 2', () => {
    expect(SUGGESTED_TEMPLATES_LIMIT).toBe(2);
    expect(run(true)).toHaveLength(2);
  });

  it('never suggests a hidden template', () => {
    expect(run(true)).not.toContain('hidden');
    expect(run(false)).not.toContain('hidden');
  });

  it('never suggests a custom template to Basic', () => {
    // All templates tie on score, so the name tie-break makes "mine" eligible for Pro…
    const proAll = suggestHomeTemplates({
      templates: [tpl('mine', { isBuiltIn: false })],
      isPro: true,
      isHidden: () => false,
      recoveringMuscleIds: new Set(),
      recentlyWorkedMuscleIds: new Set(),
      lastDoneByTemplate: {},
      getTemplateMuscles: (t) => muscles[t.id] ?? [],
    });
    expect(proAll.map((s) => s.template.id)).toEqual(['mine']);
    // …but Basic can't start it, so it's filtered out.
    expect(run(false)).not.toContain('mine');
  });
});

describe('decideTemplateStart', () => {
  const builtIn = { isBuiltIn: true };
  const custom = { isBuiltIn: false };

  it('Basic + custom template → paywall (custom_templates), even with a session in progress', () => {
    expect(decideTemplateStart({ isPro: false, template: custom, hasActiveSession: false })).toBe(
      'paywall:custom_templates'
    );
    expect(decideTemplateStart({ isPro: false, template: custom, hasActiveSession: true })).toBe(
      'paywall:custom_templates'
    );
  });

  it('Basic + empty workout → paywall (empty_workout)', () => {
    expect(decideTemplateStart({ isPro: false, template: 'empty', hasActiveSession: false })).toBe(
      'paywall:empty_workout'
    );
  });

  it('a session in progress → the resume prompt', () => {
    expect(decideTemplateStart({ isPro: false, template: builtIn, hasActiveSession: true })).toBe(
      'resume-prompt'
    );
    expect(decideTemplateStart({ isPro: true, template: custom, hasActiveSession: true })).toBe(
      'resume-prompt'
    );
    expect(decideTemplateStart({ isPro: true, template: 'empty', hasActiveSession: true })).toBe(
      'resume-prompt'
    );
  });

  it('templates open the preview; the empty workout skips it', () => {
    expect(decideTemplateStart({ isPro: false, template: builtIn, hasActiveSession: false })).toBe(
      'preview'
    );
    expect(decideTemplateStart({ isPro: true, template: custom, hasActiveSession: false })).toBe(
      'preview'
    );
    expect(decideTemplateStart({ isPro: true, template: 'empty', hasActiveSession: false })).toBe(
      'active-workout'
    );
  });
});
