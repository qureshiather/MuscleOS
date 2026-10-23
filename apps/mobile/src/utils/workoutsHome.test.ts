import { describe, expect, it } from 'vitest';
import type { MuscleId, WorkoutTemplate } from '@muscleos/types';
import {
  ARCHIVED_SECTION,
  HIDDEN_CUSTOM_SECTION,
  SUGGESTED_TEMPLATES_LIMIT,
  decideTemplateStart,
  defaultFolderExpanded,
  lastDoneByTemplate,
  suggestHomeTemplates,
} from './workoutsHome';
import { yourWorkoutTemplates } from '@/store/templatesLogic';

const tpl = (id: string, over: Partial<WorkoutTemplate> = {}): WorkoutTemplate => ({
  id,
  name: id,
  exerciseIds: ['x'],
  isBuiltIn: true,
  ...over,
});

describe('defaultFolderExpanded', () => {
  it('real folders start open; Archived and Hidden start closed', () => {
    expect(defaultFolderExpanded('folder_1')).toBe(true);
    expect(defaultFolderExpanded('builtin_ppl')).toBe(true);
    expect(defaultFolderExpanded(ARCHIVED_SECTION)).toBe(false);
    expect(defaultFolderExpanded(HIDDEN_CUSTOM_SECTION)).toBe(false);
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
  };
  const run = (templates: WorkoutTemplate[]) =>
    suggestHomeTemplates({
      templates,
      recoveringMuscleIds: new Set(),
      recentlyWorkedMuscleIds: new Set(),
      lastDoneByTemplate: {},
      getTemplateMuscles: (t) => muscles[t.id] ?? ['chest'],
      nowMs: Date.parse('2026-01-10T00:00:00.000Z'),
    }).map((s) => s.template.id);

  it('caps at 2', () => {
    expect(SUGGESTED_TEMPLATES_LIMIT).toBe(2);
    expect(run([tpl('chest'), tpl('back'), tpl('legs')])).toHaveLength(2);
  });

  it('suggests custom templates like any other — everyone can run them', () => {
    expect(run([tpl('mine', { isBuiltIn: false })])).toEqual(['mine']);
  });

  it('only picks from Your workouts: never a hidden template or a program you are not following', () => {
    const userTemplates = [
      tpl('mine', { isBuiltIn: false }),
      tpl('hidden', { isBuiltIn: false, hidden: true }),
    ];
    const picked = run(yourWorkoutTemplates({ userTemplates, activeProgramId: 'builtin_sl' }));
    expect(picked.length).toBeGreaterThan(0);
    for (const id of picked) expect(['sl-a', 'sl-b', 'mine']).toContain(id);
    expect(run(yourWorkoutTemplates({ userTemplates, activeProgramId: null }))).toEqual(['mine']);
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
