export type SyncEntityType =
  | 'session'
  | 'template'
  | 'template_folder'
  | 'custom_exercise'
  | 'recovery'
  | 'exercise_previous'
  | 'exercise_note'
  | 'app_settings';

export interface OutboxEntry {
  entityType: SyncEntityType;
  entityId: string;
  op: 'upsert' | 'delete';
  payload?: unknown;
  updatedAt: string;
}

export interface SyncMeta {
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  lastSyncedAt: string | null;
}

export interface RemoteSyncRecord {
  user_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  payload: unknown | null;
  updated_at: string;
  deleted_at: string | null;
}
