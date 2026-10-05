import { describe, expect, it } from 'vitest';
import type { MuscleId, WorkoutTemplate } from '@muscleos/types';
import {
  ARCHIVED_SECTION,
  HIDDEN_BUILT_IN_SECTION,
  HIDDEN_CUSTOM_SECTION,
  SUGGESTED_TEMPLATES_LIMIT,
  decideTemplateStart,
  defaultFolderExpanded,
  lastDoneByTemplate,
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
  const run = () =>
    suggestHomeTemplates({
      templates,
      isHidden: (t) => t.id === 'hidden',
      recoveringMuscleIds: new Set(),
      recentlyWorkedMuscleIds: new Set(),
      lastDoneByTemplate: {},
      getTemplateMuscles: (t) => muscles[t.id] ?? [],
      nowMs: Date.parse('2026-01-10T00:00:00.000Z'),
    }).map((s) => s.template.id);

  it('caps at 2', () => {
    expect(SUGGESTED_TEMPLATES_LIMIT).toBe(2);
    expect(run()).toHaveLength(2);
  });

  it('never suggests a hidden template', () => {
    expect(run()).not.toContain('hidden');
    expect(run()).not.toContain('hidden');
  });

  it('suggests custom templates like any other — everyone can run them', () => {
    const only = suggestHomeTemplates({
      templates: [tpl('mine', { isBuiltIn: false })],
      isHidden: () => false,
      recoveringMuscleIds: new Set(),
      recentlyWorkedMuscleIds: new Set(),
      lastDoneByTemplate: {},
      getTemplateMuscles: (t) => muscles[t.id] ?? [],
    });
    expect(only.map((s) => s.template.id)).toEqual(['mine']);
  });
});

describe('decideTemplateStart', () => {
  const builtIn = { isBuiltIn: true };
  const custom = { isBuiltIn: false };

  it('a session in progress → the resume prompt', () => {
    for (const template of [builtIn, custom, 'empty' as const]) {
      expect(decideTemplateStart({ template, hasActiveSession: true })).toBe('resume-prompt');
    }
  });

  it('built-in and custom templates open the preview; the empty workout skips it', () => {
    expect(decideTemplateStart({ template: builtIn, hasActiveSession: false })).toBe('preview');
    expect(decideTemplateStart({ template: custom, hasActiveSession: false })).toBe('preview');
    expect(decideTemplateStart({ template: 'empty', hasActiveSession: false })).toBe('active-workout');
  });
});
