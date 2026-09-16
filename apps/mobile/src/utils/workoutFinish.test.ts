import { describe, expect, it } from 'vitest';
import {
  finishFlowVariant,
  finishSaveOptions,
  templateListChanged,
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
