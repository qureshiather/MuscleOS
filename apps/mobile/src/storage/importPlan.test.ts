import { describe, expect, it } from 'vitest';
import { describeImportPlan, importPlanIsEmpty, type LocalData, parseExportFile, planImport } from './importPlan';

const emptyLocal: LocalData = {
  sessions: [],
  templates: [],
  templateFolders: [],
  customExercises: [],
  exerciseNotes: {},
};

function exportJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    exportedAt: '2026-09-30T10:00:00.000Z',
    templates: [],
    sessions: [],
    recovery: [],
    ...overrides,
  });
}

describe('parseExportFile', () => {
  it('reads a version 1 export', () => {
    const result = parseExportFile(
      exportJson({
        sessions: [{ id: 's1', startedAt: '2026-09-01T10:00:00.000Z' }],
        templates: [{ id: 'mine' }, { id: 'push', isBuiltIn: true }],
        templateFolders: [{ id: 'f1' }],
        customExercises: [{ id: 'c1' }],
        exerciseNotes: { bench: 'Seat 4', squat: '  ' },
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.file.exportedAt).toBe('2026-09-30T10:00:00.000Z');
    expect(result.file.sessions.map((s) => s.id)).toEqual(['s1']);
    expect(result.file.templates.map((t) => t.id)).toEqual(['mine']);
    expect(result.file.templateFolders.map((f) => f.id)).toEqual(['f1']);
    expect(result.file.customExercises.map((e) => e.id)).toEqual(['c1']);
    expect(result.file.exerciseNotes).toEqual({ bench: 'Seat 4' });
  });

  it('drops rows without an id', () => {
    const result = parseExportFile(exportJson({ sessions: [{ id: 's1' }, { startedAt: 'x' }, null, 'junk', { id: '' }] }));
    expect(result.ok && result.file.sessions.map((s) => s.id)).toEqual(['s1']);
  });

  it('rejects non-JSON and files that are not MuscleOS exports', () => {
    expect(parseExportFile('not json')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseExportFile('[]')).toEqual({ ok: false, reason: 'invalid' });
    expect(parseExportFile(JSON.stringify({ version: 1, sessions: [] }))).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects other export versions', () => {
    expect(parseExportFile(exportJson({ version: 2 }))).toEqual({ ok: false, reason: 'unsupported_version' });
  });
});

describe('planImport', () => {
  function parsed(overrides: Record<string, unknown>) {
    const result = parseExportFile(exportJson(overrides));
    if (!result.ok) throw new Error('fixture should parse');
    return result.file;
  }

  it('adds only rows this device does not have', () => {
    const file = parsed({
      sessions: [{ id: 's1' }, { id: 's2' }],
      templates: [{ id: 't1' }],
      templateFolders: [{ id: 'f1' }],
      customExercises: [{ id: 'c1' }, { id: 'c2' }],
      exerciseNotes: { bench: 'Imported', squat: 'Imported' },
    });
    const plan = planImport(
      {
        sessions: [{ id: 's1' }],
        templates: [{ id: 't1' }],
        templateFolders: [],
        customExercises: [{ id: 'c2' }],
        exerciseNotes: { bench: 'Local' },
      },
      file
    );
    expect(plan.sessions.map((s) => s.id)).toEqual(['s2']);
    expect(plan.templates).toEqual([]);
    expect(plan.templateFolders.map((f) => f.id)).toEqual(['f1']);
    expect(plan.customExercises.map((e) => e.id)).toEqual(['c1']);
    expect(plan.exerciseNotes).toEqual({ squat: 'Imported' });
  });

  it('dedupes repeated ids inside the file', () => {
    const plan = planImport(emptyLocal, parsed({ sessions: [{ id: 's1' }, { id: 's1' }] }));
    expect(plan.sessions).toHaveLength(1);
  });

  it('is empty when re-importing what is already here', () => {
    const file = parsed({ sessions: [{ id: 's1' }], exerciseNotes: { bench: 'x' } });
    const plan = planImport({ ...emptyLocal, sessions: [{ id: 's1' }], exerciseNotes: { bench: 'x' } }, file);
    expect(importPlanIsEmpty(plan)).toBe(true);
  });
});

describe('describeImportPlan', () => {
  it('lists what will be added', () => {
    const plan = planImport(
      emptyLocal,
      (() => {
        const r = parseExportFile(
          exportJson({ sessions: [{ id: 'a' }, { id: 'b' }], templates: [{ id: 't' }], customExercises: [{ id: 'c' }] })
        );
        if (!r.ok) throw new Error('fixture should parse');
        return r.file;
      })()
    );
    expect(describeImportPlan(plan)).toBe('2 workouts, 1 template and 1 custom exercise');
  });

  it('handles one kind and nothing', () => {
    const one = planImport(emptyLocal, {
      exportedAt: null,
      sessions: [],
      templates: [],
      templateFolders: [],
      customExercises: [],
      exerciseNotes: { bench: 'x' },
    });
    expect(describeImportPlan(one)).toBe('1 exercise note');
    expect(
      describeImportPlan(
        planImport(emptyLocal, {
          exportedAt: null,
          sessions: [],
          templates: [],
          templateFolders: [],
          customExercises: [],
          exerciseNotes: {},
        })
      )
    ).toBe('nothing new');
  });
});
