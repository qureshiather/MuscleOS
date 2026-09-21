import { describe, expect, it } from 'vitest';
import { CATALOG_SEED } from './catalogSeed';
import { resolveTemplateExercises } from '@/utils/templateExercises';
import {
  BUILT_IN_FOLDERS,
  BUILT_IN_TEMPLATES,
  isBuiltInHidden,
} from './builtInTemplates';

describe('built-in templates', () => {
  it('groups programs into folders including Upper Lower Splits', () => {
    expect(BUILT_IN_FOLDERS.map((f) => f.id)).toEqual([
      'builtin_ppl',
      'builtin_ul',
      'builtin_sl',
    ]);
  });

  it('keeps every template in a known folder', () => {
    const folderIds = new Set(BUILT_IN_FOLDERS.map((f) => f.id));
    expect(BUILT_IN_TEMPLATES.every((t) => t.isBuiltIn)).toBe(true);
    expect(BUILT_IN_TEMPLATES.every((t) => t.folderId != null && folderIds.has(t.folderId))).toBe(
      true
    );
    expect(BUILT_IN_TEMPLATES.filter((t) => t.folderId === 'builtin_ul').map((t) => t.id)).toEqual([
      'ul-upper-a',
      'ul-lower-a',
      'ul-upper-b',
      'ul-lower-b',
    ]);
  });

  it('hides a whole folder without requiring each template id', () => {
    const push = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')!;
    const pull = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-pull')!;
    const workoutA = BUILT_IN_TEMPLATES.find((t) => t.id === 'sl-a')!;

    expect(isBuiltInHidden(push, [], ['builtin_ppl'])).toBe(true);
    expect(isBuiltInHidden(pull, [], ['builtin_ppl'])).toBe(true);
    expect(isBuiltInHidden(workoutA, [], ['builtin_ppl'])).toBe(false);
  });

  it('keeps individually hidden templates hidden after a folder is shown again', () => {
    const push = BUILT_IN_TEMPLATES.find((t) => t.id === 'ppl-push')!;
    expect(isBuiltInHidden(push, ['ppl-push'], [])).toBe(true);
    expect(isBuiltInHidden(push, ['ppl-push'], ['builtin_ppl'])).toBe(true);
  });

  it('only references catalog exercise ids', () => {
    const catalogIds = new Set(CATALOG_SEED.map((e) => e.id));
    const missing = BUILT_IN_TEMPLATES.flatMap((t) =>
      t.exerciseIds.filter((id) => !catalogIds.has(id)).map((id) => `${t.id}:${id}`)
    );
    expect(missing).toEqual([]);
  });

  it('starts Strong Lifts with 5 working sets per exercise', () => {
    for (const id of ['sl-a', 'sl-b']) {
      const template = BUILT_IN_TEMPLATES.find((t) => t.id === id)!;
      expect(resolveTemplateExercises(template).every((ex) => ex.sets === 5 && ex.warmUpSets === 0)).toBe(
        true
      );
    }
  });
});
