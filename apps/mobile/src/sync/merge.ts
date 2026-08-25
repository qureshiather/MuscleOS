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
import type { RemoteSyncRecord, SyncEntityType } from './types';

function sessionUpdatedAt(session: WorkoutSession): string {
  return session.completedAt ?? session.startedAt;
}

function pickNewerSession(a: WorkoutSession, b: WorkoutSession): WorkoutSession {
  return sessionUpdatedAt(b) >= sessionUpdatedAt(a) ? b : a;
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

  const sessionMap = new Map(sessions.map((s) => [s.id, s]));
  const templateMap = new Map(templates.map((t) => [t.id, t]));
  const folderMap = new Map(folders.map((f) => [f.id, f]));
  const exerciseMap = new Map(customExercises.map((e) => [e.id, e]));
  let recoveryData = recovery;
  let recoveryUpdatedAt = recovery.at(-1)?.trainedAt ?? '';
  let previousData = exercisePrevious;
  let previousUpdatedAt = '';
  let notesData = exerciseNotes;
  let notesUpdatedAt = '';
  let settingsData = appSettings;
  let settingsUpdatedAt = '';

  for (const record of records) {
    const updatedAt = record.updated_at;

    if (record.deleted_at) {
      switch (record.entity_type) {
        case 'session':
          sessionMap.delete(record.entity_id);
          break;
        case 'template':
          templateMap.delete(record.entity_id);
          break;
        case 'template_folder':
          folderMap.delete(record.entity_id);
          break;
        case 'custom_exercise':
          exerciseMap.delete(record.entity_id);
          break;
        case 'recovery':
          if (updatedAt >= recoveryUpdatedAt) {
            recoveryData = [];
            recoveryUpdatedAt = updatedAt;
          }
          break;
        case 'exercise_previous':
          if (updatedAt >= previousUpdatedAt) {
            previousData = {};
            previousUpdatedAt = updatedAt;
          }
          break;
        case 'exercise_note':
          if (updatedAt >= notesUpdatedAt) {
            notesData = {};
            notesUpdatedAt = updatedAt;
          }
          break;
        case 'app_settings':
          if (updatedAt >= settingsUpdatedAt) {
            settingsData = defaultAppSettings();
            settingsUpdatedAt = updatedAt;
          }
          break;
      }
      continue;
    }

    switch (record.entity_type) {
      case 'session': {
        const remote = record.payload as WorkoutSession;
        const local = sessionMap.get(record.entity_id);
        sessionMap.set(record.entity_id, local ? pickNewerSession(local, remote) : remote);
        break;
      }
      case 'template': {
        templateMap.set(record.entity_id, record.payload as WorkoutTemplate);
        break;
      }
      case 'template_folder': {
        folderMap.set(record.entity_id, record.payload as TemplateFolder);
        break;
      }
      case 'custom_exercise': {
        exerciseMap.set(record.entity_id, record.payload as Exercise);
        break;
      }
      case 'recovery': {
        if (updatedAt >= recoveryUpdatedAt) {
          recoveryData = record.payload as MuscleRecovery[];
          recoveryUpdatedAt = updatedAt;
        }
        break;
      }
      case 'exercise_previous': {
        if (updatedAt >= previousUpdatedAt) {
          previousData = record.payload as Record<string, ExercisePrevious>;
          previousUpdatedAt = updatedAt;
        }
        break;
      }
      case 'exercise_note': {
        if (updatedAt >= notesUpdatedAt) {
          notesData = (record.payload as Record<string, string>) ?? {};
          notesUpdatedAt = updatedAt;
        }
        break;
      }
      case 'app_settings': {
        if (updatedAt >= settingsUpdatedAt) {
          settingsData = normalizeAppSettings(
            record.payload as Partial<SyncedAppSettings> | null,
            settingsData
          );
          settingsUpdatedAt = updatedAt;
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
  ]);

  return true;
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
