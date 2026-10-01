import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import {
  getCustomExercises,
  getExerciseNotes,
  getSessions,
  getTemplateFolders,
  getTemplates,
  setCustomExercises,
  setExerciseNotes,
  setExercisePrevious,
  setRecovery,
  setSessions,
  setTemplateFolders,
  setTemplates,
} from './localStorage';
import { type ImportPlan, type ParseImportResult, parseExportFile, planImport } from './importPlan';
import { useExercisesStore } from '@/store/exercisesStore';
import { rebuildPreviousSnapshot } from '@/store/activeWorkoutLogic';
import { recoveryFromSessions } from '@/utils/recovery';
import { getOutboxMap, outboxEntryKey, setOutbox } from '@/sync/outbox';
import type { OutboxEntry } from '@/sync/types';

export type PickedImport =
  | { status: 'cancelled' }
  | { status: 'failed'; reason: Extract<ParseImportResult, { ok: false }>['reason'] }
  | { status: 'ready'; plan: ImportPlan; exportedAt: string | null };

/** Let the user choose an export file and work out what it would add to this device. */
export async function pickImportFile(): Promise<PickedImport> {
  const picked = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (picked.canceled || !picked.assets?.[0]) return { status: 'cancelled' };

  const text = await FileSystem.readAsStringAsync(picked.assets[0].uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  const parsed = parseExportFile(text);
  if (!parsed.ok) return { status: 'failed', reason: parsed.reason };

  const [sessions, templates, templateFolders, customExercises, exerciseNotes] = await Promise.all([
    getSessions(),
    getTemplates(),
    getTemplateFolders(),
    getCustomExercises(),
    getExerciseNotes(),
  ]);
  const plan = planImport({ sessions, templates, templateFolders, customExercises, exerciseNotes }, parsed.file);
  return { status: 'ready', plan, exportedAt: parsed.file.exportedAt };
}

/**
 * Write the plan to this device, rebuild the derived data (recovery, previous), and queue every
 * imported row for upload in one outbox write. The next push sends it if an account is linked;
 * linking later uploads the whole device anyway.
 */
export async function applyImport(plan: ImportPlan): Promise<void> {
  const [sessions, templates, templateFolders, customExercises, exerciseNotes] = await Promise.all([
    getSessions(),
    getTemplates(),
    getTemplateFolders(),
    getCustomExercises(),
    getExerciseNotes(),
  ]);
  const nextSessions = [...sessions, ...plan.sessions];
  const nextNotes = { ...exerciseNotes, ...plan.exerciseNotes };
  const hasNewNotes = Object.keys(plan.exerciseNotes).length > 0;

  await Promise.all([
    setSessions(nextSessions),
    setTemplates([...templates, ...plan.templates]),
    setTemplateFolders([...templateFolders, ...plan.templateFolders]),
    setCustomExercises([...customExercises, ...plan.customExercises]),
    hasNewNotes ? setExerciseNotes(nextNotes) : Promise.resolve(),
  ]);

  // Imported sessions can reference imported custom exercises, so load those before recovery.
  await useExercisesStore.getState().load();
  const getExercise = useExercisesStore.getState().getExercise;
  const previous = rebuildPreviousSnapshot(nextSessions);
  await Promise.all([setRecovery(recoveryFromSessions(nextSessions, getExercise)), setExercisePrevious(previous)]);

  const now = new Date().toISOString();
  const entries: OutboxEntry[] = [
    ...plan.sessions.map((s) => ({
      entityType: 'session' as const,
      entityId: s.id,
      op: 'upsert' as const,
      payload: s,
      updatedAt: s.completedAt ?? s.startedAt ?? now,
    })),
    ...plan.templates.map((t) => ({
      entityType: 'template' as const,
      entityId: t.id,
      op: 'upsert' as const,
      payload: t,
      updatedAt: now,
    })),
    ...plan.templateFolders.map((f) => ({
      entityType: 'template_folder' as const,
      entityId: f.id,
      op: 'upsert' as const,
      payload: f,
      updatedAt: now,
    })),
    ...plan.customExercises.map((e) => ({
      entityType: 'custom_exercise' as const,
      entityId: e.id,
      op: 'upsert' as const,
      payload: e,
      updatedAt: now,
    })),
  ];
  if (plan.sessions.length) {
    entries.push({ entityType: 'exercise_previous', entityId: 'default', op: 'upsert', payload: previous, updatedAt: now });
  }
  if (hasNewNotes) {
    entries.push({ entityType: 'exercise_note', entityId: 'default', op: 'upsert', payload: nextNotes, updatedAt: now });
  }
  const outbox = await getOutboxMap();
  for (const entry of entries) outbox.set(outboxEntryKey(entry.entityType, entry.entityId), entry);
  await setOutbox(Array.from(outbox.values()));

  const { reloadSyncedStores } = await import('@/sync/merge');
  await reloadSyncedStores();
  const { schedulePush } = await import('@/sync');
  schedulePush(0);
}
