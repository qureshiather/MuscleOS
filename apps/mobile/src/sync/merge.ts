import type {
  WorkoutSession,
  WorkoutTemplate,
  TemplateFolder,
  Exercise,
  MuscleRecovery,
} from '@muscleos/types';
import {
  getSessions,
  setSessions,
  getTemplates,
  setTemplates,
  getTemplateFolders,
  setTemplateFolders,
  getCustomExercises,
  setCustomExercises,
  getRecovery,
  setRecovery,
  getExercisePrevious,
  setExercisePrevious,
  getExerciseNotes,
  setExerciseNotes,
  getAppSettings,
  setAppSettings,
  defaultAppSettings,
  normalizeAppSettings,
  type ExercisePrevious,
  type SyncedAppSettings,
} from '@/storage/localStorage';
import { getOutboxMap, outboxEntryKey, setOutbox } from './outbox';
import {
  bumpUpdatedAtIfNeeded,
  decideEntityApply,
  mergeAppSettingsPreferLocal,
  mergeExercisePreviousMap,
  mergeStringMap,
} from './mergePolicy';
import type { OutboxEntry, RemoteSyncRecord, SyncEntityType } from './types';
import { normalizeExercise } from '@/utils/exerciseNormalize';

function sessionUpdatedAt(session: WorkoutSession): string {
  return session.completedAt ?? session.startedAt;
}

function dirtyEntry(
  outboxMap: Map<string, OutboxEntry>,
  entityType: SyncEntityType,
  entityId: string
): OutboxEntry | undefined {
  return outboxMap.get(outboxEntryKey(entityType, entityId));
}

function touchDirtyOutbox(
  outboxMap: Map<string, OutboxEntry>,
  entry: OutboxEntry,
  remoteUpdatedAt: string,
  payload?: unknown
): void {
  const updatedAt = bumpUpdatedAtIfNeeded(entry.updatedAt, remoteUpdatedAt);
  outboxMap.set(outboxEntryKey(entry.entityType, entry.entityId), {
    ...entry,
    updatedAt,
    ...(payload !== undefined ? { payload } : {}),
  });
}

/** Apply remote sync records onto local state. Returns true if any records were applied. */
export async function applyRemoteRecords(records: RemoteSyncRecord[]): Promise<boolean> {
  if (records.length === 0) return false;

  const [
    sessions,
    templates,
    folders,
    customExercises,
    recovery,
    exercisePrevious,
    exerciseNotes,
    appSettings,
    outboxMap,
  ] = await Promise.all([
    getSessions(),
    getTemplates(),
    getTemplateFolders(),
    getCustomExercises(),
    getRecovery(),
    getExercisePrevious(),
    getExerciseNotes(),
    getAppSettings(),
    getOutboxMap(),
  ]);

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const exerciseMap = new Map(customExercises.map((e) => [e.id, e]));
  let recoveryData = recovery;
  let previousData = exercisePrevious;
  let notesData = exerciseNotes;
  let settingsData = appSettings;
  let changed = false;

  for (const record of records) {
    const remoteUpdatedAt = record.updated_at;
    const pending = dirtyEntry(outboxMap, record.entity_type, record.entity_id);
    const isDirty = !!pending;

    if (record.deleted_at) {
      switch (record.entity_type) {
        case 'session': {
          const local = sessionMap.get(record.entity_id);
          const decision = decideEntityApply({
            hasLocal: !!local,
            isDirty,
            localUpdatedAt: pending?.updatedAt ?? (local ? sessionUpdatedAt(local) : null),
            remoteUpdatedAt,
          });
          if (decision === 'take_remote') {
            if (sessionMap.delete(record.entity_id)) changed = true;
          } else if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt);
          }
          break;
        }
        case 'template': {
          const local = templateMap.get(record.entity_id);
          const decision = decideEntityApply({
            hasLocal: !!local,
            isDirty,
            localUpdatedAt: pending?.updatedAt ?? null,
            remoteUpdatedAt,
          });
          if (decision === 'take_remote') {
            if (templateMap.delete(record.entity_id)) changed = true;
          } else if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt);
          }
          break;
        }
        case 'template_folder': {
          const local = folderMap.get(record.entity_id);
          const decision = decideEntityApply({
            hasLocal: !!local,
            isDirty,
            localUpdatedAt: pending?.updatedAt ?? null,
            remoteUpdatedAt,
          });
          if (decision === 'take_remote') {
            if (folderMap.delete(record.entity_id)) changed = true;
          } else if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt);
          }
          break;
        }
        case 'custom_exercise': {
          const local = exerciseMap.get(record.entity_id);
          const decision = decideEntityApply({
            hasLocal: !!local,
            isDirty,
            localUpdatedAt: pending?.updatedAt ?? null,
            remoteUpdatedAt,
          });
          if (decision === 'take_remote') {
            if (exerciseMap.delete(record.entity_id)) changed = true;
          } else if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt);
          }
          break;
        }
        case 'recovery':
        case 'exercise_previous':
        case 'exercise_note':
        case 'app_settings': {
          const decision = decideEntityApply({
            hasLocal: true,
            isDirty,
            localUpdatedAt: pending?.updatedAt ?? null,
            remoteUpdatedAt,
          });
          if (decision === 'take_remote') {
            if (record.entity_type === 'recovery') recoveryData = [];
            if (record.entity_type === 'exercise_previous') previousData = {};
            if (record.entity_type === 'exercise_note') notesData = {};
            if (record.entity_type === 'app_settings') settingsData = defaultAppSettings();
            changed = true;
          } else if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt);
          }
          break;
        }
      }
      continue;
    }

    switch (record.entity_type) {
      case 'session': {
        const remote = record.payload as WorkoutSession;
        const local = sessionMap.get(record.entity_id);
        const decision = decideEntityApply({
          hasLocal: !!local,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? (local ? sessionUpdatedAt(local) : null),
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          sessionMap.set(record.entity_id, remote);
          changed = true;
        } else if (pending) {
          touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, local ?? pending.payload);
        }
        break;
      }
      case 'template': {
        const remote = record.payload as WorkoutTemplate;
        const local = templateMap.get(record.entity_id);
        const decision = decideEntityApply({
          hasLocal: !!local,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? null,
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          templateMap.set(record.entity_id, remote);
          changed = true;
        } else if (pending) {
          touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, local ?? pending.payload);
        }
        break;
      }
      case 'template_folder': {
        const remote = record.payload as TemplateFolder;
        const local = folderMap.get(record.entity_id);
        const decision = decideEntityApply({
          hasLocal: !!local,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? null,
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          folderMap.set(record.entity_id, remote);
          changed = true;
        } else if (pending) {
          touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, local ?? pending.payload);
        }
        break;
      }
      case 'custom_exercise': {
        const remote = record.payload as Exercise;
        const local = exerciseMap.get(record.entity_id);
        const decision = decideEntityApply({
          hasLocal: !!local,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? null,
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          exerciseMap.set(record.entity_id, normalizeExercise(remote, record.entity_id));
          changed = true;
        } else if (pending) {
          touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, local ?? pending.payload);
        }
        break;
      }
      case 'recovery': {
        const remote = (record.payload as MuscleRecovery[]) ?? [];
        const decision = decideEntityApply({
          hasLocal: recoveryData.length > 0 || isDirty,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? (recoveryData.at(-1)?.trainedAt ?? null),
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          recoveryData = remote;
          changed = true;
        } else if (pending) {
          touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, recoveryData);
        }
        break;
      }
      case 'exercise_previous': {
        const remote = (record.payload as Record<string, ExercisePrevious>) ?? {};
        const decision = decideEntityApply({
          hasLocal: Object.keys(previousData).length > 0 || isDirty,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? null,
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          previousData = remote;
          changed = true;
        } else {
          // Local wins conflicts; empty local keys fill from remote (net-new + gaps)
          const merged = mergeExercisePreviousMap(previousData, remote);
          if (JSON.stringify(merged) !== JSON.stringify(previousData)) {
            previousData = merged;
            changed = true;
          }
          if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, previousData);
          }
        }
        break;
      }
      case 'exercise_note': {
        const remote = (record.payload as Record<string, string>) ?? {};
        const decision = decideEntityApply({
          hasLocal: Object.keys(notesData).length > 0 || isDirty,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? null,
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          notesData = remote;
          changed = true;
        } else {
          const merged = mergeStringMap(notesData, remote);
          if (JSON.stringify(merged) !== JSON.stringify(notesData)) {
            notesData = merged;
            changed = true;
          }
          if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, notesData);
          }
        }
        break;
      }
      case 'app_settings': {
        const remote = normalizeAppSettings(
          record.payload as Partial<SyncedAppSettings> | null,
          defaultAppSettings()
        );
        const decision = decideEntityApply({
          hasLocal: true,
          isDirty,
          localUpdatedAt: pending?.updatedAt ?? null,
          remoteUpdatedAt,
        });
        if (decision === 'take_remote') {
          settingsData = remote;
          changed = true;
        } else {
          // Prefer local non-empty fields; fill empty local slots from remote
          const merged = mergeAppSettingsPreferLocal(settingsData, remote);
          if (JSON.stringify(merged) !== JSON.stringify(settingsData)) {
            settingsData = merged;
            changed = true;
          }
          if (pending) {
            touchDirtyOutbox(outboxMap, pending, remoteUpdatedAt, settingsData);
          }
        }
        break;
      }
    }
  }

  await Promise.all([
    setSessions(Array.from(sessionMap.values())),
    setTemplates(Array.from(templateMap.values())),
    setTemplateFolders(Array.from(folderMap.values())),
    setCustomExercises(Array.from(exerciseMap.values())),
    setRecovery(recoveryData),
    setExercisePrevious(previousData),
    setExerciseNotes(notesData),
    setAppSettings(settingsData),
    setOutbox(Array.from(outboxMap.values())),
  ]);

  return changed || records.length > 0;
}

/** Snapshot of all local user data for initial account link upload. */
export async function collectFullLocalSnapshot(): Promise<
  Array<{
    entityType: SyncEntityType;
    entityId: string;
    payload: unknown;
    updatedAt: string;
  }>
> {
  const [
    sessions,
    templates,
    folders,
    customExercises,
    recovery,
    exercisePrevious,
    exerciseNotes,
    appSettings,
  ] = await Promise.all([
    getSessions(),
    getTemplates(),
    getTemplateFolders(),
    getCustomExercises(),
    getRecovery(),
    getExercisePrevious(),
    getExerciseNotes(),
    getAppSettings(),
  ]);

  const now = new Date().toISOString();
  const items: Array<{
    entityType: SyncEntityType;
    entityId: string;
    payload: unknown;
    updatedAt: string;
  }> = [];

  for (const session of sessions) {
    items.push({
      entityType: 'session',
      entityId: session.id,
      payload: session,
      updatedAt: sessionUpdatedAt(session),
    });
  }
  for (const template of templates) {
    items.push({ entityType: 'template', entityId: template.id, payload: template, updatedAt: now });
  }
  for (const folder of folders) {
    items.push({ entityType: 'template_folder', entityId: folder.id, payload: folder, updatedAt: now });
  }
  for (const exercise of customExercises) {
    items.push({ entityType: 'custom_exercise', entityId: exercise.id, payload: exercise, updatedAt: now });
  }
  if (recovery.length) {
    items.push({
      entityType: 'recovery',
      entityId: 'default',
      payload: recovery,
      updatedAt: recovery.at(-1)?.trainedAt ?? now,
    });
  }
  if (Object.keys(exercisePrevious).length) {
    items.push({
      entityType: 'exercise_previous',
      entityId: 'default',
      payload: exercisePrevious,
      updatedAt: now,
    });
  }
  if (Object.keys(exerciseNotes).length) {
    items.push({
      entityType: 'exercise_note',
      entityId: 'default',
      payload: exerciseNotes,
      updatedAt: now,
    });
  }
  items.push({
    entityType: 'app_settings',
    entityId: 'default',
    payload: appSettings,
    updatedAt: now,
  });

  return items;
}

export async function reloadSyncedStores(): Promise<void> {
  const { useSessionsStore } = await import('@/store/sessionsStore');
  const { useTemplatesStore } = await import('@/store/templatesStore');
  const { useExercisesStore } = await import('@/store/exercisesStore');
  const { useRecoveryStore } = await import('@/store/recoveryStore');
  const { useExerciseNotesStore } = await import('@/store/exerciseNotesStore');
  const { useSettingsStore } = await import('@/store/settingsStore');

  await Promise.all([
    useSessionsStore.getState().load(),
    useTemplatesStore.getState().load(),
    useExercisesStore.getState().load(),
    useRecoveryStore.getState().load(),
    useExerciseNotesStore.getState().load(),
    useSettingsStore.getState().load(),
  ]);
}
