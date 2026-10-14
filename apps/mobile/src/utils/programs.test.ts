import { describe, expect, it } from 'vitest';
import { BUILT_IN_PROGRAMS, builtInProgram } from '@/data/builtInTemplates';
import type { MuscleId } from '@muscleos/types';
import {
  NO_PROGRAM,
  orderPrograms,
  programAction,
  programActionHint,
  programMeta,
  programForTemplate,
  programDayMeta,
  programOverview,
} from './programs';

describe('programAction', () => {
  it('adds when no program is chosen', () => {
    const action = programAction('builtin_ppl', null);
    expect(action).toEqual({ kind: 'add', label: 'Add to your workouts' });
    expect(programActionHint(action)).toBe('Its workouts join your templates on the Workouts tab.');
  });

  it('switches when another program is chosen, naming the one it replaces', () => {
    const action = programAction('builtin_phul', 'builtin_ppl');
    expect(action.kind).toBe('replace');
    expect(action.label).toBe('Switch to PHUL');
    expect(programActionHint(action)).toBe(
      'Replaces Push Pull Legs in Your workouts. Your templates and history stay.'
    );
  });

  it('removes the program you are already following', () => {
    const action = programAction('builtin_sl', 'builtin_sl');
    expect(action).toEqual({ kind: 'remove', label: 'Remove from your workouts' });
    expect(programActionHint(action)).toBe('Your templates and history stay.');
  });

  it('treats an unknown chosen id as no program', () => {
    expect(programAction('builtin_sl', 'builtin_gone').kind).toBe('add');
  });
});

describe('orderPrograms', () => {
  const ids = (items: ReturnType<typeof orderPrograms>) =>
    items.map((i) => (i === NO_PROGRAM ? 'none' : i.id));

  it('with no program, No program comes first, then every program as shipped', () => {
    expect(ids(orderPrograms(BUILT_IN_PROGRAMS, null))).toEqual([
      'none',
      'builtin_sl',
      'builtin_ppl',
      'builtin_ul',
      'builtin_phul',
    ]);
  });

  it('with a program, it comes first, the rest as shipped, and No program last', () => {
    expect(ids(orderPrograms(BUILT_IN_PROGRAMS, 'builtin_ul'))).toEqual([
      'builtin_ul',
      'builtin_sl',
      'builtin_ppl',
      'builtin_phul',
      'none',
    ]);
  });
});

describe('programMeta', () => {
  it('shows days per week and how many workouts', () => {
    expect(programMeta(builtInProgram('builtin_sl')!)).toBe('3 days/wk · 2 workouts');
    expect(programMeta(builtInProgram('builtin_phul')!)).toBe('4 days/wk · 4 workouts');
  });
});

describe('programOverview', () => {
  const names: Record<string, { name: string; muscles: MuscleId[] }> = {
    squat: { name: 'Squat', muscles: ['quads', 'glutes'] },
    'bench-press': { name: 'Bench Press', muscles: ['chest', 'triceps'] },
    'barbell-row': { name: 'Barbell Row', muscles: ['lats', 'glutes'] },
  };
  const overview = programOverview('builtin_sl', (id) => names[id]);

  it('lists every workout with its exercises, working sets and first-listed muscle', () => {
    expect(overview.days.map((d) => d.template.id)).toEqual(['sl-a', 'sl-b']);
    expect(overview.days[0].exercises).toEqual([
      { exerciseId: 'squat', name: 'Squat', sets: 5, muscle: 'quads' },
      { exerciseId: 'bench-press', name: 'Bench Press', sets: 5, muscle: 'chest' },
      { exerciseId: 'barbell-row', name: 'Barbell Row', sets: 5, muscle: 'lats' },
    ]);
  });

  it('collects each workout\'s muscles once, in first-seen order', () => {
    expect(overview.days[0].muscleIds).toEqual(['quads', 'glutes', 'chest', 'triceps', 'lats']);
  });

  it('falls back to the id and no muscle for an unknown exercise', () => {
    expect(overview.days[1].exercises[1]).toEqual({
      exerciseId: 'overhead-press',
      name: 'overhead-press',
      sets: 5,
      muscle: undefined,
    });
  });

  it('totals working sets per workout and across one pass of the program', () => {
    expect(overview.days.map((d) => d.totalSets)).toEqual([15, 15]);
    expect(overview.totalSets).toBe(30);
    expect(programOverview('builtin_phul', () => undefined).totalSets).toBe(85);
  });
});

describe('programDayMeta', () => {
  it('counts exercises and sets, singular when one', () => {
    expect(programDayMeta({ exercises: new Array(6), totalSets: 18 })).toBe('6 exercises · 18 sets');
    expect(programDayMeta({ exercises: new Array(1), totalSets: 1 })).toBe('1 exercise · 1 set');
  });
});

describe('programForTemplate', () => {
  it('finds a built-in template\'s program, and none for customs or a missing template', () => {
    expect(programForTemplate({ isBuiltIn: true, folderId: 'builtin_phul' })?.name).toBe('PHUL');
    expect(programForTemplate({ isBuiltIn: false, folderId: 'builtin_phul' })).toBeUndefined();
    expect(programForTemplate(undefined)).toBeUndefined();
  });
});
