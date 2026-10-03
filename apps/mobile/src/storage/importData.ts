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
import {
  type ImportPlan,
  type ParseImportResult,
  importOutboxEntries,
  parseExportFile,
  planImport,
} from './importPlan';
import { useExercisesStore } from '@/store/exercisesStore';
import { rebuildPreviousSnapshot } from '@/store/activeWorkoutLogic';
import { recoveryFromSessions } from '@/utils/recovery';
import { enqueueOutboxMany } from '@/sync/outbox';

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
 * Write the plan to this device, rebuild the derived data (recovery, previous), and — when an
 * account is linked — queue every imported row for upload in one outbox write. A guest queues
 * nothing: linking or signing in later uploads the device's data anyway.
 */
export async function applyImport(plan: ImportPlan, now = () => new Date().toISOString()): Promise<void> {
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

  // A guest's import stays local; linking an account uploads the whole device anyway.
  const { isCloudSyncEnabled, schedulePush } = await import('@/sync');
  if (isCloudSyncEnabled()) {
    await enqueueOutboxMany(importOutboxEntries(plan, previous, nextNotes, now()));
  }

  const { reloadSyncedStores } = await import('@/sync/merge');
  await reloadSyncedStores();
  schedulePush(0);
}
