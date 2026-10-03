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
  /**
   * The account this transport (outbox + watermark) belongs to. Null in metas written before it
   * was tracked; the next signed-in sync adopts the current user.
   */
  userId: string | null;
  lastPulledAt: string | null;
  lastPushedAt: string | null;
  lastSyncedAt: string | null;
  /**
   * Set when the transport switched to a different account. The next sync pulls everything, then
   * uploads the local rows that account doesn't have yet (the guest's data on sign-in).
   */
  pendingLocalUpload?: boolean;
}

export interface RemoteSyncRecord {
  user_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  payload: unknown | null;
  updated_at: string;
  deleted_at: string | null;
}
