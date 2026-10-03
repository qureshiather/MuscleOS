import { describe, expect, it } from 'vitest';
import type { WorkoutSession } from '@muscleos/types';
import {
  buildFinishSummary,
  cancelDialogMeta,
  completedSetCount,
  formatSummarySet,
  hasSetDetail,
  finishFlowVariant,
  finishSaveOptions,
  templateListChanged,
  templateStructureChanged,
  type FinishActionId,
} from './workoutFinish';

const ids = (opts: { id: FinishActionId }[]) => opts.map((o) => o.id);
const proIds = (opts: { id: FinishActionId; requiresPro: boolean }[]) =>
  opts.filter((o) => o.requiresPro).map((o) => o.id);

describe('templateListChanged', () => {
  it('is false when the session matches the template exactly', () => {
    expect(templateListChanged(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe(false);
  });

  it('is true when an exercise is added or removed', () => {
    expect(templateListChanged(['a', 'b', 'c', 'd'], ['a', 'b', 'c'])).toBe(true);
    expect(templateListChanged(['a', 'b'], ['a', 'b', 'c'])).toBe(true);
  });

  it('is true when the same exercises are reordered', () => {
    expect(templateListChanged(['a', 'c', 'b'], ['a', 'b', 'c'])).toBe(true);
  });

  it('is true when an exercise is replaced', () => {
    expect(templateListChanged(['a', 'x', 'c'], ['a', 'b', 'c'])).toBe(true);
  });
});

describe('templateStructureChanged', () => {
  const slot = (exerciseId: string, sets: number, warmUpSets = 0) => ({
    exerciseId,
    sets,
    warmUpSets,
  });

  it('is false when identity, order, and set counts all match', () => {
    expect(
      templateStructureChanged(
        [slot('a', 3), slot('b', 5, 2)],
        [slot('a', 3), slot('b', 5, 2)]
      )
    ).toBe(false);
  });

  it('is true when working or warm-up counts differ, even if the exercise list matches', () => {
    expect(
      templateStructureChanged([slot('a', 4), slot('b', 3)], [slot('a', 3), slot('b', 3)])
    ).toBe(true);
    expect(
      templateStructureChanged([slot('a', 3, 2), slot('b', 3)], [slot('a', 3), slot('b', 3)])
    ).toBe(true);
  });

  it('is true when the exercise list changed', () => {
    expect(templateStructureChanged([slot('a', 3), slot('c', 3)], [slot('a', 3), slot('b', 3)])).toBe(
      true
    );
  });
});

describe('finishFlowVariant', () => {
  it('classifies an empty/ad-hoc workout regardless of listChanged', () => {
    expect(finishFlowVariant({ isEmpty: true, isBuiltIn: false, listChanged: false })).toBe('empty');
    expect(finishFlowVariant({ isEmpty: true, isBuiltIn: false, listChanged: true })).toBe('empty');
  });

  it('classifies an unchanged template run as unchanged, built-in or custom alike', () => {
    expect(finishFlowVariant({ isEmpty: false, isBuiltIn: true, listChanged: false })).toBe('unchanged');
    expect(finishFlowVariant({ isEmpty: false, isBuiltIn: false, listChanged: false })).toBe('unchanged');
  });

  it('distinguishes a changed built-in from a changed custom template', () => {
    expect(finishFlowVariant({ isEmpty: false, isBuiltIn: true, listChanged: true })).toBe('builtin-changed');
    expect(finishFlowVariant({ isEmpty: false, isBuiltIn: false, listChanged: true })).toBe('custom-changed');
  });
});

describe('finishSaveOptions', () => {
  it('empty workout: save as template (Pro), save values only, discard', () => {
    const opts = finishSaveOptions({ isEmpty: true, isBuiltIn: false, listChanged: false });
    expect(ids(opts)).toEqual(['save_as_template', 'save_values', 'discard']);
    expect(proIds(opts)).toEqual(['save_as_template']);
  });

  it('finishing an unchanged built-in offers only save values and discard — never overwrite', () => {
    const opts = finishSaveOptions({ isEmpty: false, isBuiltIn: true, listChanged: false });
    expect(ids(opts)).toEqual(['save_values', 'discard']);
    expect(opts.find((o) => o.id === 'save_values')?.label).toBe('Save values');
    expect(ids(opts)).not.toContain('overwrite');
    expect(ids(opts)).not.toContain('save_as_template');
  });

  it('a changed built-in cannot be overwritten — only forked into a new custom template (Pro)', () => {
    const opts = finishSaveOptions({ isEmpty: false, isBuiltIn: true, listChanged: true });
    expect(ids(opts)).toEqual(['save_as_template', 'save_values', 'discard']);
    expect(ids(opts)).not.toContain('overwrite');
    expect(opts.find((o) => o.id === 'save_as_template')?.label).toBe('Save as new template');
    expect(proIds(opts)).toEqual(['save_as_template']);
  });

  it('a changed custom template can be overwritten or saved as new — both Pro', () => {
    const opts = finishSaveOptions({ isEmpty: false, isBuiltIn: false, listChanged: true });
    expect(ids(opts)).toEqual(['save_values', 'overwrite', 'save_as_template', 'discard']);
    expect(proIds(opts).sort()).toEqual(['overwrite', 'save_as_template']);
  });

  it('always offers a non-Pro way to keep the values and a discard', () => {
    for (const input of [
      { isEmpty: true, isBuiltIn: false, listChanged: false },
      { isEmpty: false, isBuiltIn: true, listChanged: false },
      { isEmpty: false, isBuiltIn: true, listChanged: true },
      { isEmpty: false, isBuiltIn: false, listChanged: true },
      { isEmpty: false, isBuiltIn: false, listChanged: false },
    ]) {
      const opts = finishSaveOptions(input);
      const saveValues = opts.find((o) => o.id === 'save_values');
      expect(saveValues?.requiresPro).toBe(false);
      expect(ids(opts)).toContain('discard');
    }
  });
});

const session = (exercises: WorkoutSession['exercises'], templateId = 'ppl-push') => ({
  templateId,
  exercises,
});

describe('cancelDialogMeta', () => {
  it('has no fact line while nothing is completed', () => {
    expect(cancelDialogMeta(session([{ exerciseId: 'a', sets: [{ completed: false, reps: 5 }] }]), 60_000))
      .toBeUndefined();
  });

  it('shows elapsed m:ss and the completed-set count (singular / plural)', () => {
    const one = session([{ exerciseId: 'a', sets: [{ completed: true }, { completed: false }] }]);
    expect(cancelDialogMeta(one, 12 * 60_000 + 5_000)).toBe('12:05 · 1 set');
    const three = session([
      { exerciseId: 'a', sets: [{ completed: true }, { completed: true }] },
      { exerciseId: 'b', sets: [{ completed: true, isWarmUp: true }] },
    ]);
    expect(completedSetCount(three)).toBe(3);
    expect(cancelDialogMeta(three, 65_000)).toBe('1:05 · 3 sets');
  });
});

describe('buildFinishSummary', () => {
  const nameOf = (id: string) => ({ a: 'Bench Press', b: 'Row' })[id] ?? id;

  it('lists only exercises with a completed set, and only their completed sets', () => {
    const s = session([
      {
        exerciseId: 'a',
        sets: [
          { completed: true, weightKg: 60, reps: 5 },
          { completed: false, weightKg: 60, reps: 5 },
        ],
      },
      { exerciseId: 'b', sets: [{ completed: false }] },
      { exerciseId: 'c', sets: [{ completed: true, reps: 10 }, { completed: true, reps: 8 }] },
    ]);
    const summary = buildFinishSummary(s, 'Push', nameOf, 1000);
    expect(summary.name).toBe('Push');
    expect(summary.durationMs).toBe(1000);
    expect(summary.exercises.map((e) => [e.name, e.completed])).toEqual([
      ['Bench Press', 1],
      ['c', 2],
    ]);
    expect(summary.exercises[0].sets).toEqual([{ completed: true, weightKg: 60, reps: 5 }]);
    expect(summary.totalSets).toBe(3);
  });

  it('names an ad-hoc session "Empty workout" and a missing template "Workout"', () => {
    expect(buildFinishSummary(session([], '_empty'), undefined, nameOf, 0).name).toBe('Empty workout');
    expect(buildFinishSummary(session([], 'tpl_gone'), undefined, nameOf, 0).name).toBe('Workout');
  });
});

describe('formatSummarySet', () => {
  it('formats weight × reps, with the unit only when asked', () => {
    expect(formatSummarySet({ weightKg: 60, reps: 5 }, 'kg', true)).toBe('60 kg × 5 reps');
    expect(formatSummarySet({ weightKg: 60, reps: 5 }, 'kg', false)).toBe('60 × 5 reps');
    expect(formatSummarySet({ weightKg: 100, reps: 5 }, 'lb', true)).toBe('220.5 lb × 5 reps');
  });

  it('falls back to whichever value exists, or —; zero weight counts as none', () => {
    expect(formatSummarySet({ reps: 12 }, 'kg', true)).toBe('12 reps');
    expect(formatSummarySet({ weightKg: 40 }, 'kg', true)).toBe('40 kg');
    expect(formatSummarySet({ weightKg: 0 }, 'kg', true)).toBe('—');
    expect(formatSummarySet({}, 'kg', true)).toBe('—');
  });

  it('hasSetDetail is false when no set has weight or reps', () => {
    expect(hasSetDetail([{}, {}])).toBe(false);
    expect(hasSetDetail([{}, { reps: 1 }])).toBe(true);
  });
});
