/**
 * Import of a MuscleOS export file (Data → Import data). Pure: no React Native or storage
 * imports, so parsing and the merge plan are unit tested.
 *
 * Import only adds. Anything already on this device (same id, or a note for the same exercise)
 * is kept as-is, so importing the same file twice changes nothing.
 */
import type { Exercise, TemplateFolder, WorkoutSession, WorkoutTemplate } from '@muscleos/types';

export const SUPPORTED_EXPORT_VERSION = 1;

export type ImportFile = {
  exportedAt: string | null;
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  templateFolders: TemplateFolder[];
  customExercises: Exercise[];
  exerciseNotes: Record<string, string>;
};

export type ParseImportResult =
  | { ok: true; file: ImportFile }
  | { ok: false; reason: 'invalid' | 'unsupported_version' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Rows without a string id can't be merged or synced, so they're dropped. */
function withIds<T>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row) => isRecord(row) && typeof row.id === 'string' && row.id.length > 0) as T[];
}

function stringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, note] of Object.entries(value)) {
    if (typeof note === 'string' && note.trim()) out[key] = note;
  }
  return out;
}

export function parseExportFile(text: string): ParseImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'invalid' };
  }
  if (!isRecord(raw) || !Array.isArray(raw.sessions) || !Array.isArray(raw.templates)) {
    return { ok: false, reason: 'invalid' };
  }
  if (raw.version !== SUPPORTED_EXPORT_VERSION) return { ok: false, reason: 'unsupported_version' };

  return {
    ok: true,
    file: {
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
      sessions: withIds<WorkoutSession>(raw.sessions),
      // Built-ins ship with the app; only the user's own templates are imported.
      templates: withIds<WorkoutTemplate>(raw.templates).filter((t) => !t.isBuiltIn),
      templateFolders: withIds<TemplateFolder>(raw.templateFolders),
      customExercises: withIds<Exercise>(raw.customExercises),
      exerciseNotes: stringMap(raw.exerciseNotes),
    },
  };
}

export type LocalData = {
  sessions: { id: string }[];
  templates: { id: string }[];
  templateFolders: { id: string }[];
  customExercises: { id: string }[];
  exerciseNotes: Record<string, string>;
};

export type ImportPlan = {
  sessions: WorkoutSession[];
  templates: WorkoutTemplate[];
  templateFolders: TemplateFolder[];
  customExercises: Exercise[];
  /** Notes for exercises that have none on this device. */
  exerciseNotes: Record<string, string>;
};

function notIn<T extends { id: string }>(rows: T[], existing: { id: string }[]): T[] {
  const ids = new Set(existing.map((row) => row.id));
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (ids.has(row.id) || seen.has(row.id)) return false;
    seen.add(row.id);
    return true;
  });
}

export function planImport(local: LocalData, file: ImportFile): ImportPlan {
  const exerciseNotes: Record<string, string> = {};
  for (const [exerciseId, note] of Object.entries(file.exerciseNotes)) {
    if (!local.exerciseNotes[exerciseId]?.trim()) exerciseNotes[exerciseId] = note;
  }
  return {
    sessions: notIn(file.sessions, local.sessions),
    templates: notIn(file.templates, local.templates),
    templateFolders: notIn(file.templateFolders, local.templateFolders),
    customExercises: notIn(file.customExercises, local.customExercises),
    exerciseNotes,
  };
}

export function importPlanIsEmpty(plan: ImportPlan): boolean {
  return (
    plan.sessions.length === 0 &&
    plan.templates.length === 0 &&
    plan.templateFolders.length === 0 &&
    plan.customExercises.length === 0 &&
    Object.keys(plan.exerciseNotes).length === 0
  );
}

function count(n: number, one: string, many: string): string | null {
  if (n === 0) return null;
  return `${n} ${n === 1 ? one : many}`;
}

/** "12 workouts, 2 templates and 1 custom exercise" — for the confirm dialog. */
export function describeImportPlan(plan: ImportPlan): string {
  const parts = [
    count(plan.sessions.length, 'workout', 'workouts'),
    count(plan.templates.length, 'template', 'templates'),
    count(plan.templateFolders.length, 'folder', 'folders'),
    count(plan.customExercises.length, 'custom exercise', 'custom exercises'),
    count(Object.keys(plan.exerciseNotes).length, 'exercise note', 'exercise notes'),
  ].filter((part): part is string => part != null);
  if (parts.length <= 1) return parts[0] ?? 'nothing new';
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** Data → Import data: dialog copy when the file can't be used. */
export function importFailureMessage(reason: Extract<ParseImportResult, { ok: false }>['reason']): string {
  return reason === 'unsupported_version'
    ? 'This export is from a different version of MuscleOS. Update the app and try again.'
    : 'Choose a file made with Export my data in MuscleOS.';
}

/** Data → Import data: the confirm dialog body. Signed-in users are told it also backs up. */
export function importConfirmMessage(summary: string, isLinked: boolean): string {
  return `Add ${summary} to this device? Nothing already here is changed or removed.${
    isLinked ? ' It also backs up to your account.' : ''
  }`;
}

/** Shape-compatible with the sync outbox entry (structural, so this file stays pure). */
export type ImportOutboxEntry = {
  entityType: 'session' | 'template' | 'template_folder' | 'custom_exercise' | 'exercise_previous' | 'exercise_note';
  entityId: string;
  op: 'upsert';
  payload: unknown;
  updatedAt: string;
};

/**
 * Outbox upserts for an applied import: every imported row, plus the rebuilt previous snapshot when
 * sessions were added and the merged notes snapshot when notes were added. Sessions keep their own
 * clock (completedAt, else startedAt); everything else is stamped `now`.
 */
export function importOutboxEntries(
  plan: ImportPlan,
  previous: unknown,
  nextNotes: Record<string, string>,
  now: string
): ImportOutboxEntry[] {
  const upsert = (
    entityType: ImportOutboxEntry['entityType'],
    entityId: string,
    payload: unknown,
    updatedAt = now
  ): ImportOutboxEntry => ({ entityType, entityId, op: 'upsert', payload, updatedAt });
  const entries: ImportOutboxEntry[] = [
    ...plan.sessions.map((s) => upsert('session', s.id, s, s.completedAt ?? s.startedAt ?? now)),
    ...plan.templates.map((t) => upsert('template', t.id, t)),
    ...plan.templateFolders.map((f) => upsert('template_folder', f.id, f)),
    ...plan.customExercises.map((e) => upsert('custom_exercise', e.id, e)),
  ];
  if (plan.sessions.length) entries.push(upsert('exercise_previous', 'default', previous));
  if (Object.keys(plan.exerciseNotes).length) entries.push(upsert('exercise_note', 'default', nextNotes));
  return entries;
}
